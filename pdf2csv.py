#!/usr/bin/env python3
"""調剤報酬統計表PDF → CSV変換スクリプト"""
import fitz
import csv
import re
import os
import sys
import glob

def get_items(page):
    """ページからテキストアイテムを座標付きで抽出（重複除去）"""
    raw = []
    for block in page.get_text("dict")["blocks"]:
        if "lines" in block:
            for line in block["lines"]:
                for span in line["spans"]:
                    t = span["text"].strip()
                    if t:
                        raw.append({"text": t, "x": round(span["bbox"][0], 1), "y": round(span["bbox"][1], 1)})
    unique = []
    for item in raw:
        if not any(abs(u["x"] - item["x"]) < 2 and abs(u["y"] - item["y"]) < 2 and u["text"] == item["text"] for u in unique):
            unique.append(item)
    return unique

def group_rows(items, tolerance=5):
    """y座標で行グループ化"""
    rows = []
    for item in items:
        found = False
        for row in rows:
            if abs(row["y"] - item["y"]) < tolerance:
                row["items"].append(item)
                found = True
                break
        if not found:
            rows.append({"y": item["y"], "items": [item]})
    for row in rows:
        row["items"].sort(key=lambda i: i["x"])
    rows.sort(key=lambda r: r["y"])
    return rows

def extract_num(text):
    """テキストから数値を抽出"""
    cleaned = re.sub(r'[回枚円%剤件点]', '', text.replace(',', ''))
    try:
        return float(cleaned) if '.' in cleaned else int(cleaned)
    except:
        return None

def find_cnt_amt_from_items(items):
    """個別アイテムから件数・金額を安全に抽出（テキスト結合による誤認を防止）"""
    cnt = None
    amt = None
    for item in items:
        t = item["text"]
        # 「XXX件」パターン（アイテム単体で完結）
        m = re.match(r'^([\d,]+)件', t)
        if m and cnt is None:
            cnt = int(m.group(1).replace(',', ''))
        # 「XXX円」パターン（アイテム単体で完結、負数は増減なので除外）
        m2 = re.match(r'^([\d,]+)円', t)
        if m2 and amt is None:
            amt = int(m2.group(1).replace(',', ''))

    # 結合テキスト内の「XXX件XXX円」パターンにもフォールバック
    # ただし項目名の末尾数字と値が結合するケースに注意
    if cnt is None or amt is None:
        for item in items:
            t = item["text"]
            # 結合パターン: 「2,644件539,272円4.19%」
            parts = re.findall(r'([\d,]+)件|([\d,]+)円', t)
            for p in parts:
                if p[0] and cnt is None:
                    cnt = int(p[0].replace(',', ''))
                if p[1] and amt is None:
                    amt = int(p[1].replace(',', ''))
    return cnt, amt

def parse_tokei_pdf(pdf_path):
    """調剤報酬統計表PDFを解析してdict形式で返す"""
    doc = fitz.open(pdf_path)
    result = {}

    # ===== ページ1 =====
    items1 = get_items(doc[0])
    rows1 = group_rows(items1)

    # 期間を取得
    for row in rows1:
        for item in row["items"]:
            m = re.match(r'令和(\d+)年(\d+)月(\d+)日$', item["text"])
            if m and 'period_start' not in result:
                y = 2018 + int(m.group(1))
                result['period_start'] = f"{y}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
                result['year_month'] = f"{y}-{int(m.group(2)):02d}"

    # --- 基本指標（左カラム）---
    LEFT_MAP = {
        '処方箋受付回数': 'rx_count',
        '処方箋受付枚数': 'rx_sheets',
        '後発調剤率': 'ge_rate',
        '平均剤数': 'avg_zai',
        '調剤報酬金額': 'total_reward',
        '処方箋単価': 'rx_price',
        '保険分・患者負担金額': 'hoken_futan2',
        '自費分・患者負担金額': 'jhi_chozai_amt',
        '保険外・患者負担金額': 'hokengai_amt',
        'その他金額': 'bussan_amt',
        'ＯＴＣ金額': 'otc_amt',
        '選定療養金額': 'sentei_amt',
        '手帳活用実績': 'techo_rate',
    }

    for row in rows1:
        left = [i for i in row["items"] if i["x"] < 390]
        label = ''.join(i["text"] for i in left)

        # 剤数
        if '剤' in label and '数' in label and '平均' not in label and '調製' not in label and '薬剤' not in label:
            nums = [i for i in left if re.match(r'^[\d,]+剤$', i["text"]) and i["x"] > 100]
            if nums:
                result['zai_count'] = int(nums[0]["text"].replace(',', '').replace('剤', ''))

        for key, field in LEFT_MAP.items():
            if key in label:
                val_items = [i for i in left if i["x"] > 130 and re.match(r'^[\d,.\-]+[回枚円%剤]?$', i["text"])]
                if val_items:
                    v = extract_num(val_items[0]["text"])
                    if v is not None:
                        result[field] = v
                break

    # --- 調剤基本料（右カラム）---
    RIGHT_MAP = {
        '調剤基本料': {'cnt': 'kihon_cnt', 'amt': 'kihon_amt', 'skip': ['同時', '分割']},
        '調剤基本料（同時受付）': {'cnt': 'kihon_doji_cnt', 'amt': 'kihon_doji_amt'},
        '分割調剤基本料（長期）': {'cnt': None, 'amt': 'bunkatsu_choki_amt'},
        '分割調剤基本料（後発）': {'cnt': None, 'amt': 'bunkatsu_kouhatsu_amt'},
        '分割調剤基本料（医師）': {'cnt': None, 'amt': 'bunkatsu_ishi_amt'},
        '時間外加算': {'cnt': 'jikangai_cnt', 'amt': 'jikangai_amt', 'skip': ['調剤管理']},
        '休日加算': {'cnt': 'kyujitsu_cnt', 'amt': 'kyujitsu_amt', 'skip': ['訪問']},
        '深夜加算': {'cnt': 'shinya_cnt', 'amt': 'shinya_amt', 'skip': ['訪問']},
        '夜間・休日等加算': {'cnt': 'yakan_cnt', 'amt': 'yakan_amt'},
        '医療DX推進体制整備加算': {'cnt': 'dx_cnt', 'amt': 'dx_amt'},
        '在宅薬学総合体制加算': {'cnt': 'zaitaku_taisei_cnt', 'amt': 'zaitaku_taisei_amt'},
    }
    RIGHT_SORTED = sorted(RIGHT_MAP.keys(), key=len, reverse=True)

    for row in rows1:
        right = [i for i in row["items"] if i["x"] >= 390]
        if not right:
            continue
        right_text = ''.join(i["text"] for i in right)
        for key in RIGHT_SORTED:
            ids = RIGHT_MAP[key]
            if ids.get('skip') and any(s in right_text for s in ids['skip']):
                continue
            if key in right_text:
                cnt, amt = find_cnt_amt_from_items(right)
                if cnt is not None and ids.get('cnt'):
                    result[ids['cnt']] = cnt
                if amt is not None and ids.get('amt'):
                    result[ids['amt']] = amt
                break

    # --- 薬剤調製料テーブル ---
    ZAI_MAP = {'内服': 'naifuku', '浸煎': 'sinsenn', '湯薬': 'yuyaku', '屯服': 'tonpuku',
               '外用': 'gaiyou', '注射': 'chusya', '内滴': 'naiteki', '材料': 'zairyo', '合計': 'total'}
    KAZ_COLS = ['mayaku', 'doku', 'kakusei', 'mukyoko', 'keiryo', 'keiryo_yo', 'jika', 'jika_yo', 'mukin', 'jikou', 'kazan_total']

    for row in rows1:
        first = row["items"][0]["text"] if row["items"] else ''
        if first not in ZAI_MAP:
            continue
        prefix = ZAI_MAP[first]
        nums = []
        for item in row["items"]:
            if item["x"] > 40:
                # スペース区切りの結合セル対応（例: "3726366 871321"）
                for part in item["text"].replace(',', '').split():
                    try:
                        nums.append(int(part))
                    except:
                        pass

        if prefix == 'total':
            if len(nums) >= 3:
                result['chozai_zai_total'] = nums[0]
                result['yakuzai_total'] = nums[1]
                result['chozai_total'] = nums[2]
            if len(nums) >= 14:
                for ki, kn in enumerate(KAZ_COLS):
                    result[f'kaz_total_{kn}'] = nums[3 + ki]
        else:
            if len(nums) >= 1: result[f'{prefix}_zai'] = nums[0]
            if len(nums) >= 2: result[f'{prefix}_yakuzai'] = nums[1]
            if len(nums) >= 3: result[f'{prefix}_chozai'] = nums[2]
            if len(nums) >= 14:
                for ki, kn in enumerate(KAZ_COLS):
                    result[f'{prefix}_{kn}'] = nums[3 + ki]

    # ===== ページ2: 薬学管理料 =====
    if doc.page_count >= 2:
        items2 = get_items(doc[1])
        rows2 = group_rows(items2)

        YAKU_MAP = {
            '調剤管理料（内服）': 'chmgr_nai',
            '調剤管理料（内服以外）': 'chmgr_other',
            '調剤管理加算': 'chmgr_kazan',
            '重複防止加算（残薬以外）': 'jukufuku_other',
            '重複防止加算（残薬）': 'jukufuku_zan',
            '医療情報取得加算': 'iryo_joho',
            '時間外加算（調剤管理料）': 'jikangai_kanri',
            '服薬管理指導料（薬A）手帳あり3月以内': 'fuyaku_a',
            '服薬管理指導料（薬B）手帳なし3月以内': 'fuyaku_b',
            '服薬管理指導料（薬C）3月以外': 'fuyaku_c',
            '服薬管理指導料（薬3）特養入居者': 'fuyaku_3',
            '服薬管理指導料（オンライン服薬指導）': 'fuyaku_online',
            '服薬管理指導料（連携薬剤師）': 'fuyaku_renkei',
            'かかりつけ薬剤師指導料': 'kakari',
            '麻薬管理指導加算': 'mayaku_shido',
            '特定薬剤管理指導加算1（イ）': 'tokutei_1i',
            '特定薬剤管理指導加算1（ロ）': 'tokutei_1ro',
            '特定薬剤管理指導加算2': 'tokutei_2',
            '特定薬剤管理指導加算3（イ）': 'tokutei_3i',
            '特定薬剤管理指導加算3（ロ）': 'tokutei_3ro',
            '吸入薬指導加算': 'kyunyu',
            '乳幼児服薬指導加算': 'nyuyoji',
            '小児特定加算': 'shoni',
            '調剤後薬剤管理指導料': 'chozaigo',
            'かかりつけ薬剤師包括管理料': 'kakari_hokatsu',
            '服薬情報等提供料1': 'fuyaku_joho1',
            '服薬情報等提供料2': 'fuyaku_joho2',
            '服薬情報等提供料3': 'fuyaku_joho3',
            '外来服薬支援料1': 'gaifuku1',
            '外来服薬支援料2': 'gaifuku2',
            '施設連携加算': 'setsurenkei',
            '服用薬剤調整支援料1': 'fukuyou1',
            '服用薬剤調整支援料2': 'fukuyou2',
            '経管投薬支援料': 'keikan',
            '在宅患者訪問薬剤管理指導料（単一1人）': 'zaitaku_1nin',
            '在宅患者訪問薬剤管理指導料（1人以外）': 'zaitaku_other',
            '在宅患者緊急訪問薬剤管理指導料1': 'zaitaku_kinkyu1',
            '在宅患者緊急訪問薬剤管理指導料2': 'zaitaku_kinkyu2',
            '在宅患者緊急時等共同服薬指導料': 'zaitaku_kyodo',
            '在宅患者オンライン薬剤管理指導料': 'zaitaku_online',
            '在宅患者緊急オンライン薬剤管理指導料': 'zaitaku_kinkyu_online',
            '麻薬管理加算（在宅）': 'zaitaku_mayaku',
            '乳幼児加算（在宅）': 'zaitaku_nyuyoji',
            '小児特定加算（在宅）': 'zaitaku_shoni',
            '在宅患者医療用麻薬持続注射療法加算': 'zaitaku_mayaku_chu',
            '在宅中心静脈栄養法加算': 'zaitaku_chushin',
            '夜間訪問加算': 'yakan_homon',
            '休日訪問加算': 'kyujitsu_homon',
            '深夜訪問加算': 'shinya_homon',
            '在宅患者防止管理料': 'zaitaku_boshi',
            '退院時共同指導料': 'taiin_kyodo',
            '在宅移行初期管理料': 'zaitaku_iko',
        }
        YAKU_SORTED = sorted(YAKU_MAP.keys(), key=len, reverse=True)

        for row in rows2:
            # 3カラム分割
            columns = [
                [i for i in row["items"] if i["x"] < 290],
                [i for i in row["items"] if 290 <= i["x"] < 557],
                [i for i in row["items"] if i["x"] >= 557],
            ]
            for col_items in columns:
                if not col_items:
                    continue
                col_text = ''.join(i["text"] for i in col_items)

                for key in YAKU_SORTED:
                    if key in col_text:
                        prefix = YAKU_MAP[key]
                        # 個別アイテムから安全に件数・金額を抽出
                        cnt, amt = find_cnt_amt_from_items(col_items)
                        if cnt is not None:
                            result[f'{prefix}_cnt'] = cnt
                        if amt is not None:
                            result[f'{prefix}_amt'] = amt
                        else:
                            result[f'{prefix}_amt'] = 0
                        break

    doc.close()
    return result


def parse_kazan_pdf(pdf_path):
    """加算種別内訳表PDF（一覧形式）を解析してdict形式で返す"""
    doc = fitz.open(pdf_path)
    result = {}

    # フォーマット検出: 1ページ目に「加算種別内訳表」が含まれるか
    first_items = get_items(doc[0])
    is_kazan_format = any(i["text"] == '加算種別内訳表' for i in first_items)
    if not is_kazan_format:
        # 統計表形式のPDF → parse_tokei_pdf にフォールバック
        doc.close()
        return parse_tokei_pdf(pdf_path)

    # 全ページのアイテムを取得
    all_items = []
    for page in doc:
        items = get_items(page)
        all_items.extend(items)

    # 期間を取得
    for item in all_items:
        m = re.match(r'令和(\d+)年(\d+)月(\d+)日', item["text"])
        if m and 'period_start' not in result:
            y = 2018 + int(m.group(1))
            result['period_start'] = f"{y}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
            result['year_month'] = f"{y}-{int(m.group(2)):02d}"
            break

    # 全ページを行グループ化して解析
    rows_all = []
    for page in doc:
        items = get_items(page)
        rows = group_rows(items)
        for row in rows:
            # セクションヘッダを検出
            texts = [i["text"] for i in row["items"]]
            joined = ''.join(texts)

            # 各行から加算名称・件数・合計金額を抽出
            name_parts = []
            cnt = None
            amt = None
            for i in row["items"]:
                t = i["text"]
                # 件数: "N件" or "N,NNN件"
                m_cnt = re.match(r'^([\d,]+)件$', t)
                if m_cnt:
                    cnt = int(m_cnt.group(1).replace(',', ''))
                    continue
                # 合計金額: "¥N" or "¥N,NNN"
                m_amt = re.match(r'^[¥\\]([\d,]+)$', t)
                if m_amt:
                    amt = int(m_amt.group(1).replace(',', ''))
                    continue
                # 点数は無視（"N点"）
                if re.match(r'^[\d,]+点$', t):
                    continue
                # ヘッダ行・セクション行はスキップ
                if t in ('加算名称', '件数', '点数', '合計点数', '合計金額'):
                    continue
                if re.match(r'(アフェット|注）|令和|加算種別)', t):
                    continue
                # 加算名称部分
                name_parts.append(t)

            name = ''.join(name_parts).strip()
            if name:
                rows_all.append({'name': name, 'cnt': cnt, 'amt': amt})

    # --- 加算名称 → CSVキーのマッピング ---
    # 親カテゴリのコンテキストを追跡して適用区分を判定
    TEKIYOU_MAP = {
        '内服薬適用分': 'naifuku', '屯服薬適用分': 'tonpuku',
        '外用薬適用分': 'gaiyou', '注射薬適用分': 'chusya',
        '内服用滴剤適用分': 'naiteki',
    }

    # セクション合計行のマッピング
    SECTION_TOTAL = {
        '調剤基本料合計': 'kihon_section_total',
        '薬剤調製料合計': 'chozai_section_total',
        '薬剤調製料加算合計': 'kazan_section_total',
        '薬学管理料合計': 'yakugaku_section_total',
        '在宅等合計': 'zaitaku_section_total',
        '調剤合計': 'chozai_grand_total',
        '介護合計': 'kaigo_total',
        '総合計': 'grand_total',
    }

    # 調剤基本料セクション
    KIHON_MAP = {
        '調剤基本料': 'kihon',
        '調剤基本料※同時受付': 'kihon_doji',
        '地域支援体制加算': 'chiiki_shien',
        '後発医薬品調剤体制加算': 'kouhatsu_taisei',
        '連携強化加算': 'renkei_kyoka',
        '医療DX推進体制整備加算': 'dx',  # 8点/10点を自動判別
        '在宅薬学総合体制加算': 'zaitaku_taisei',
        '時間外加算': 'jikangai',
        '休日加算': 'kyujitsu',
        '深夜加算': 'shinya',
        '夜間・休日等加算': 'yakan',
    }

    # 薬剤調製料加算の加算名称マッピング
    KAZAN_TYPE_MAP = {
        '麻薬加算': 'mayaku',
        '毒薬加算': 'doku',
        '覚せい剤原料加算': 'kakusei',
        '向精神薬加算': 'mukyoko',
        '計量混合加算': 'keiryo',
        '自家製剤加算': 'jika',
        '無菌製剤処理加算': 'mukin',
        '時間外加算': 'jikou',
    }

    # 薬学管理料マッピング（名称→キー）
    YAKUGAKU_MAP = {
        '調剤管理料': 'chmgr',
        '調剤管理加算': 'chmgr_kazan',
        '重複投薬・相互作用等防止加算（防A）': 'jukufuku_other',
        '重複投薬・相互作用等防止加算（防B）': 'jukufuku_zan',
        '重複防止加算（残薬以外）': 'jukufuku_other',
        '重複防止加算（残薬）': 'jukufuku_zan',
        '医療情報取得加算': 'iryo_joho',
        '調剤管理料（時間外加算）': 'jikangai_kanri',
        '服薬管理指導料（薬A）': 'fuyaku_a',
        '服薬管理指導料（薬B）': 'fuyaku_b',
        '服薬管理指導料（薬C）': 'fuyaku_c',
        '服薬管理指導料（薬3）': 'fuyaku_3',
        '服薬管理指導料（オンライン服薬指導）': 'fuyaku_online',
        '服薬管理指導料（連携薬剤師）': 'fuyaku_renkei',
        '服薬管理指導料（特2A）': 'fuyaku_renkei',
        'かかりつけ薬剤師指導料': 'kakari',
        'かかりつけ薬剤師包括管理料': 'kakari_hokatsu',
        '麻薬管理指導加算': 'mayaku_shido',
        '特定薬剤管理指導加算1（イ）': 'tokutei_1i',
        '特定薬剤管理指導加算1（ロ）': 'tokutei_1ro',
        '特定薬剤管理指導加算2': 'tokutei_2',
        '特定薬剤管理指導加算3（イ）': 'tokutei_3i',
        '特定薬剤管理指導加算3（ロ）': 'tokutei_3ro',
        '吸入薬指導加算': 'kyunyu',
        '乳幼児服薬指導加算': 'nyuyoji',
        '小児特定加算': 'shoni',
        '調剤後薬剤管理指導料': 'chozaigo',
        '服薬情報等提供料1': 'fuyaku_joho1',
        '服薬情報等提供料2': 'fuyaku_joho2',
        '服薬情報等提供料2（医療機関）': 'fuyaku_joho2',
        '服薬情報等提供料3': 'fuyaku_joho3',
        '外来服薬支援料1': 'gaifuku1',
        '外来服薬支援料2': 'gaifuku2',  # 親カテゴリ、日数別はGAIFUKU2_MAPで処理
        '施設連携加算': 'setsurenkei',
        '服用薬剤調整支援料1': 'fukuyou1',
        '服用薬剤調整支援料2': 'fukuyou2',
        '経管投薬支援料': 'keikan',
    }

    # 在宅マッピング
    ZAITAKU_MAP = {
        '在宅患者訪問薬剤管理指導料（訪A）': 'zaitaku_1nin',
        '在宅患者訪問薬剤管理指導料（単一1人）': 'zaitaku_1nin',
        '在宅患者訪問薬剤管理指導料（1人以外）': 'zaitaku_other',
        '在宅患者訪問薬剤管理指導料（訪B）': 'zaitaku_other',
        '在宅患者緊急訪問薬剤管理指導料1': 'zaitaku_kinkyu1',
        '在宅患者緊急訪問薬剤管理指導料2': 'zaitaku_kinkyu2',
        '在宅患者緊急時等共同服薬指導料': 'zaitaku_kyodo',
        '在宅患者オンライン薬剤管理指導料': 'zaitaku_online',
        '在宅患者緊急オンライン薬剤管理指導料': 'zaitaku_kinkyu_online',
        '麻薬管理加算（在宅）': 'zaitaku_mayaku',
        '乳幼児加算（在宅）': 'zaitaku_nyuyoji',
        '小児特定加算（在宅）': 'zaitaku_shoni',
        '在宅患者医療用麻薬持続注射療法加算': 'zaitaku_mayaku_chu',
        '在宅中心静脈栄養法加算': 'zaitaku_chushin',
        '夜間訪問加算': 'yakan_homon',
        '休日訪問加算': 'kyujitsu_homon',
        '深夜訪問加算': 'shinya_homon',
        '在宅患者防止管理料': 'zaitaku_boshi',
        '退院時共同指導料': 'taiin_kyodo',
        '在宅移行初期管理料': 'zaitaku_iko',
    }

    # セクションと親カテゴリを追跡しながらマッピング
    section = None  # 現在のセクション
    parent_kazan = None  # 薬剤調製料加算の親（麻薬加算、向精神薬加算等）
    parent_fuyaku = None  # 薬学管理料の親（薬A、薬B等）
    dx_cnt_sum = 0  # DX加算の件数合計（8点+10点）
    dx_amt_sum = 0  # DX加算の金額合計

    for row_data in rows_all:
        name = row_data['name']
        cnt = row_data['cnt']
        amt = row_data['amt']

        # セクション検出
        if '【調剤基本料】' in name:
            section = 'kihon'
            continue
        elif '【薬剤調製料】' in name:
            section = 'chozairyou'
            continue
        elif '【薬剤調製料加算】' in name:
            section = 'kazan'
            parent_kazan = None
            cur_tekiyou = None
            continue
        elif '【薬学管理料】' in name:
            section = 'yakugaku'
            parent_fuyaku = None
            continue
        elif '【在宅等】' in name or '【在宅】' in name:
            section = 'zaitaku'
            continue
        elif '【介護】' in name:
            section = 'kaigo'
            continue

        # セクション合計行（◆マーク）→ 合計を記録してスキップ
        clean = name.replace('◆', '').replace(' ', '').strip()
        is_total = False
        for total_key, csv_key in SECTION_TOTAL.items():
            if total_key in clean:
                if cnt is not None:
                    result[f'{csv_key}_cnt'] = cnt
                if amt is not None:
                    result[f'{csv_key}_amt'] = amt
                is_total = True
                break
        if is_total:
            continue

        # 適用区分行の検出（（内服薬適用分）等）
        tekiyou = None
        for tek_name, tek_key in TEKIYOU_MAP.items():
            if tek_name in name:
                tekiyou = tek_key
                break

        # --- 調剤基本料セクション ---
        if section == 'kihon':
            for kihon_name, kihon_key in KIHON_MAP.items():
                if kihon_name in name:
                    if kihon_key == 'dx':
                        # DX加算: 点数で8点/10点を判別
                        dx_sub = 'dx8' if '8点' in name else 'dx10' if '10点' in name else 'dx'
                        if cnt is not None:
                            result[f'{dx_sub}_cnt'] = cnt
                            dx_cnt_sum += cnt
                        if amt is not None:
                            result[f'{dx_sub}_amt'] = amt
                            dx_amt_sum += amt
                        result['dx_cnt'] = dx_cnt_sum
                        result['dx_amt'] = dx_amt_sum
                    elif kihon_key == 'kihon' and '同時' in name:
                        continue  # 同時受付は別キー
                    else:
                        if cnt is not None:
                            result[f'{kihon_key}_cnt'] = cnt
                        if amt is not None:
                            result[f'{kihon_key}_amt'] = amt
                    break

        # --- 薬剤調製料セクション ---
        elif section == 'chozairyou':
            if tekiyou:
                if cnt is not None:
                    result[f'{tekiyou}_zai'] = cnt
                if amt is not None:
                    result[f'{tekiyou}_chozai'] = amt

        # --- 薬剤調製料加算セクション ---
        elif section == 'kazan':
            # 親カテゴリの更新（麻薬加算、向精神薬加算等）
            for kaz_name, kaz_key in KAZAN_TYPE_MAP.items():
                if kaz_name in name and tekiyou is None:
                    parent_kazan = kaz_key
                    cur_tekiyou = None  # 適用区分リセット
                    break

            # 適用区分の更新（（内服薬適用分）等）→ 状態として保持
            if tekiyou:
                cur_tekiyou = tekiyou

            if cur_tekiyou and parent_kazan and (cnt is not None or amt is not None):
                # 適用区分 × 加算種別 → {tekiyou}_{parent_kazan}
                key = f'{cur_tekiyou}_{parent_kazan}'
                if amt is not None:
                    result[key] = result.get(key, 0) + amt
                if cnt is not None:
                    result[f'{key}_cnt'] = result.get(f'{key}_cnt', 0) + cnt

        # --- 薬学管理料セクション ---
        elif section == 'yakugaku':
            # 外来服薬支援料2の日数別内訳
            GAIFUKU2_PERIOD = {
                '7日': 'gaifuku2_7', '14日': 'gaifuku2_14', '21日': 'gaifuku2_21',
                '28日': 'gaifuku2_28', '35日': 'gaifuku2_35', '42日': 'gaifuku2_42',
                '43日': 'gaifuku2_43',
            }
            if parent_fuyaku == 'gaifuku2':
                for period, pkey in GAIFUKU2_PERIOD.items():
                    if period in name:
                        if cnt is not None:
                            result[f'{pkey}_cnt'] = cnt
                        if amt is not None:
                            result[f'{pkey}_amt'] = amt
                        break

            # 服薬管理指導料の親を追跡
            matched_yaku = False
            for yaku_name in sorted(YAKUGAKU_MAP.keys(), key=len, reverse=True):
                if yaku_name in name:
                    yaku_key = YAKUGAKU_MAP[yaku_name]
                    matched_yaku = True
                    # 親カテゴリを更新（服薬管理指導料、外来服薬支援料2等）
                    if yaku_name.startswith('服薬管理指導料') or yaku_name.startswith('外来服薬支援料'):
                        parent_fuyaku = yaku_key
                    # 子項目（特定薬剤管理指導加算、乳幼児等）は合算
                    if yaku_key in ('tokutei_1i', 'tokutei_1ro', 'tokutei_2',
                                     'tokutei_3i', 'tokutei_3ro', 'nyuyoji',
                                     'kyunyu', 'shoni'):
                        if cnt is not None:
                            result[f'{yaku_key}_cnt'] = result.get(f'{yaku_key}_cnt', 0) + cnt
                        if amt is not None:
                            result[f'{yaku_key}_amt'] = result.get(f'{yaku_key}_amt', 0) + amt
                    else:
                        if cnt is not None:
                            result[f'{yaku_key}_cnt'] = cnt
                        if amt is not None:
                            result[f'{yaku_key}_amt'] = amt
                    break

        # --- 在宅セクション ---
        elif section == 'zaitaku':
            for zai_name in sorted(ZAITAKU_MAP.keys(), key=len, reverse=True):
                if zai_name in name:
                    zai_key = ZAITAKU_MAP[zai_name]
                    if cnt is not None:
                        result[f'{zai_key}_cnt'] = cnt
                    if amt is not None:
                        result[f'{zai_key}_amt'] = amt
                    break

        # --- 介護セクション ---
        elif section == 'kaigo':
            KAIGO_MAP = {
                '薬剤師居宅療養管理指導料Ⅰ': 'kaigo1', '薬剤師居宅療養ⅡI': 'kaigo1',
                '薬剤師居宅療養管理指導料Ⅱ': 'kaigo2', '薬剤師居宅療養ⅡII': 'kaigo2',
                '薬剤師居宅療養指導料（情報通信）': 'kaigo3',
                '薬剤師居宅療養指導料（医療麻薬）': 'kaigo4',
                '予防薬剤師居宅療養管理指導料Ⅰ': 'kaigo_y1', '予防薬剤師居宅療養ⅡI': 'kaigo_y1',
                '予防薬剤師居宅療養管理指導料Ⅱ': 'kaigo_y2', '予防薬剤師居宅療養ⅡII': 'kaigo_y2',
                '予防薬剤師居宅療養指導料（情報通信）': 'kaigo_y3',
                '麻薬管理加算': 'kaigo_mayaku',
                '中心静脈栄養法加算': 'kaigo_chushin',
            }
            for kaigo_name in sorted(KAIGO_MAP.keys(), key=len, reverse=True):
                if kaigo_name in name:
                    kaigo_key = KAIGO_MAP[kaigo_name]
                    if cnt is not None:
                        result[f'{kaigo_key}_cnt'] = cnt
                    if amt is not None:
                        result[f'{kaigo_key}_amt'] = amt
                    break

    doc.close()
    return result


def result_to_csv(result, csv_path):
    """結果をCSVファイルに出力"""
    with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['項目', '値'])
        for k, v in sorted(result.items()):
            writer.writerow([k, v])
    return csv_path


def process_pdf_dir(pdf_dir, output_dir, pattern="*.pdf", parser=None):
    """指定ディレクトリ内のPDFを変換し、結果リストを返す"""
    if parser is None:
        parser = parse_tokei_pdf
    os.makedirs(output_dir, exist_ok=True)
    pdf_files = sorted(glob.glob(os.path.join(pdf_dir, pattern)))
    if not pdf_files:
        print(f"  PDFファイルが見つかりません: {pdf_dir}")
        return []

    all_results = []
    for pdf_path in pdf_files:
        fname = os.path.basename(pdf_path)
        print(f"  処理中: {fname}")
        try:
            result = parser(pdf_path)
            csv_name = fname.replace('.pdf', '.csv')
            csv_path = os.path.join(output_dir, csv_name)
            result_to_csv(result, csv_path)
            all_results.append(result)
            ym = result.get('year_month', '不明')
            print(f"    → {csv_name} ({len(result)}項目, {ym})")
        except Exception as e:
            print(f"    エラー: {e}")
    return all_results


def write_all_csv(all_results, output_path):
    """全月まとめCSV（横持ち）を出力"""
    if not all_results:
        return
    all_keys = sorted(set(k for r in all_results for k in r.keys()))
    with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['項目'] + [r.get('year_month', '?') for r in all_results])
        for key in all_keys:
            writer.writerow([key] + [r.get(key, '') for r in all_results])
    print(f"  全月まとめ: {output_path} ({len(all_results)}ヶ月)")


def get_base_dir():
    """exe実行時はexeのあるフォルダ、スクリプト実行時はスクリプトのあるフォルダ"""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(__file__)


def main():
    """メイン: 統計表・加算種別内訳表の全PDFを変換"""
    base = get_base_dir()
    output_dir = os.path.join(base, "レセコンデータ", "csv")

    # 1) 調剤報酬統計表
    tokei_dir = os.path.join(base, "レセコンデータ", "調剤報酬統計表")
    print("【調剤報酬統計表】")
    tokei_results = process_pdf_dir(tokei_dir, output_dir, "tokei_*.pdf")
    if tokei_results:
        write_all_csv(tokei_results, os.path.join(output_dir, "tokei_all.csv"))

    # 2) 加算種別内訳表
    kazan_dir = os.path.join(base, "レセコンデータ", "加算種別内訳表")
    kazan_output = os.path.join(base, "レセコンデータ", "csv_kazan")
    print("\n【加算種別内訳表】")
    kazan_results = process_pdf_dir(kazan_dir, kazan_output, "kazan_*.pdf", parser=parse_kazan_pdf)
    if kazan_results:
        write_all_csv(kazan_results, os.path.join(kazan_output, "kazan_all.csv"))


if __name__ == '__main__':
    # 単一ファイルモード
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
        result = parse_tokei_pdf(pdf_path)
        csv_path = pdf_path.replace('.pdf', '.csv')
        result_to_csv(result, csv_path)
        print(f"変換完了: {csv_path} ({len(result)}項目)")
        for k, v in sorted(result.items()):
            print(f"  {k}: {v}")
    else:
        main()
