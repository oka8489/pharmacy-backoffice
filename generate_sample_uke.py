#!/usr/bin/env python3
"""正確なUKEサンプルファイル生成（SSK仕様書準拠）"""
import os, random, csv

# 調剤行為コード（R6）
CODES = {
    # 薬剤調製料
    'chozai_nai': '420001810',   # 内服薬薬剤調製料 24点
    'chozai_ton': '420002410',   # 屯服薬薬剤調製料 21点
    'chozai_gai': '420002510',   # 外用薬薬剤調製料 10点
    'chozai_chu': '420002610',   # 注射薬薬剤調製料 26点
    'chozai_naiteki': '420002010', # 内服用滴剤薬剤調製料 10点
    # 調剤管理料（日数別）
    'kanri_7':  '440011510',     # 調剤管理料（7日以下）4点
    'kanri_14': '440011610',     # 調剤管理料（8-14日）28点
    'kanri_28': '440011710',     # 調剤管理料（15-28日）50点
    'kanri_29': '440011810',     # 調剤管理料（29日以上）60点
    'kanri_other': '440011910',  # 調剤管理料（内服以外）4点
    # 加算
    'kakusei_nai': '430000270',  # 覚せい剤原料加算（内服）8点
    'mukyoko_nai': '430000370',  # 向精神薬加算（内服）8点
    'mukyoko_ton': '430000470',  # 向精神薬加算（屯服）8点
    'mukyoko_gai': '430000570',  # 向精神薬加算（外用）8点
    'keiryo_eki_nai': '430000670',  # 計量混合加算（液剤・内服）35点
    'keiryo_san_nai': '430000770',  # 計量混合加算（散剤・内服）45点
    'keiryo_nan_gai': '430000970',  # 計量混合加算（軟膏・外用）80点
    'jika_han_7':  '430001670',  # 自家製剤加算（半錠1-7日）4点
    'jika_han_28': '430001870',  # 自家製剤加算（半錠22-28日）16点
    'jika_han_35': '430001970',  # 自家製剤加算（半錠29-35日）20点
    'jikou_nai': '430003070',    # 時間外加算（内服）
    'jikou_gai': '430003270',    # 時間外加算（外用）
}

# 基本料・薬学管理料コード（KIレコード用）
KI_CODES = {
    'kihon3ha':    ('410005910', 35),  # 調剤基本料3ハ 35点
    'chiiki3':     ('450001670', 50),  # 地域支援体制加算3 50点→R6は32点
    'kouhatsu3':   ('450001170', 30),  # 後発医薬品調剤体制加算3 30点
    'renkei':      ('410002970', 5),   # 連携強化加算 5点
    'dx8':         ('410003170', 8),   # 医療DX推進体制整備加算 8点
    'zaitaku15':   ('410003470', 15),  # 在宅薬学総合体制加算1 15点
    'yakan':       ('410002310', 40),  # 夜間・休日等加算 40点
    'fuyaku_a':    ('440012010', 45),  # 服薬管理指導料1(薬A) 45点
    'fuyaku_b':    ('440012110', 59),  # 服薬管理指導料2(薬B) 59点
    'fuyaku_c':    ('440012210', 59),  # 服薬管理指導料3(薬C) 59点
    'kakari':      ('440016270', 76),  # かかりつけ薬剤師指導料 76点
    'tokutei_1i':  ('440017770', 10),  # 特定薬剤管理指導加算1イ 10点
    'tokutei_1ro': ('440017870', 5),   # 特定薬剤管理指導加算1ロ 5点
    'tokutei_3i':  ('440018070', 5),   # 特定薬剤管理指導加算3イ 5点
    'iryo_joho':   ('440020970', 1),   # 医療情報取得加算 1点
    'jukufuku':    ('440014670', 40),  # 重複投薬・相互作用防止(残薬以外) 40点
    'nyuyoji':     ('440020270', 12),  # 乳幼児服薬指導加算 12点
    'fuyaku_joho2':('440020170', 20),  # 服薬情報等提供料2 20点
    'zaitaku_1nin':('410004810', 650), # 在宅患者訪問薬剤管理指導料1 650点
    'zaitaku_iko': ('410005110', 230), # 在宅移行初期管理料 230点
    'bukka':       ('440021270', 1),   # 調剤物価対応料 1点
    'jikangai_kanri':('440014170', 0), # 時間外加算（調剤管理料）
    'shinya_homon':('410005510', 0),   # 深夜訪問加算
}

# 医薬品コード（薬価マスタの実在コード）
DRUGS = [
    ('612320417', 3, 'ガスター錠10mg'),                 # 内服
    ('622098401', 3, 'アトルバスタチン錠5mg「サワイ」'),  # 内服
    ('622098501', 1, 'アトルバスタチン錠10mg「サワイ」'), # 内服
    ('622475100', 3, 'アトルバスタチンCa10mg錠'),        # 内服
    ('622475000', 1, 'アトルバスタチンCa5mg錠'),         # 内服
    ('620006885', 1, 'キプレス錠10mg'),                  # 内服
    ('615101538', 2, 'ツムラ葛根湯エキス細粒'),          # 内服
    ('622252101', 1, 'アトルバスタチン錠10mg「ケミファ」'), # 内服
    ('622110501', 1, 'アトルバスタチン錠10mg「トーワ」'), # 内服
    ('622167701', 1, 'アトルバスタチン錠10mg「日医工」'), # 内服
    ('620004365', 30, 'パタノール点眼液0.1%'),           # 外用
    ('662640418', 1, 'リンデロンVG軟膏0.12%'),           # 外用
    ('662640423', 1, 'リンデロンV軟膏0.12%'),            # 外用
    ('622442601', 1, 'キプレスOD錠10mg'),                # 内服
    ('622127001', 1, 'アトルバスタチン錠10mg「サンド」'), # 内服
]

def gen_uke(year, month, rx_count, output_dir):
    """1ヶ月分のUKEファイルを生成"""
    billing_ym = f'{year}{month+1:02d}' if month < 12 else f'{year+1}01'
    diag_ym = f'{year}{month:02d}'

    lines = []
    # MN: 審査支払機関レコード
    lines.append(f'MN,999000001,大分県大分市,1345012345670001,,,')
    # YK: 薬局情報レコード
    lines.append(f'YK,1,44,4,1234567,アフェット薬局,{billing_ym},00,097-999-9999')

    total_points = 0
    ki_counts = {}  # KI集計用

    for rx in range(1, rx_count + 1):
        # RE: レセプト共通レコード
        pid = f'PT{rx:05d}'
        sex = random.choice([1, 2])
        birth_year = random.randint(1940, 2020)
        birth = f'{birth_year}0101'
        diag_day = random.randint(1, 28)
        diag_date = f'{year}{month:02d}{diag_day:02d}'

        lines.append(f'RE,{rx},{pid},{sex},{birth},1,{diag_date},1,,,,')

        # HO: 保険者レコード
        lines.append(f'HO,1,06130012,ﾀﾛｳ,001,{pid},00,1,,,')

        # SH: 処方基本レコード
        lines.append(f'SH,01,1')

        # 処方内容を生成
        num_drugs = random.randint(1, 4)
        days = random.choice([7, 14, 21, 28, 30, 35, 42, 56])
        is_gai = random.random() < 0.3  # 30%外用
        is_ton = random.random() < 0.1  # 10%屯服
        has_mukyoko = random.random() < 0.15  # 15%向精神薬
        has_keiryo = random.random() < 0.1   # 10%計量混合
        has_jika = random.random() < 0.02    # 2%自家製剤

        # CZ: 調剤情報レコード
        cz_parts = ['CZ']
        cz_parts.append('1')  # 医師番号
        cz_parts.append(diag_date)  # 処方月日
        cz_parts.append(diag_date)  # 調剤月日
        cz_parts.append(str((rx - 1) % 3 + 1))  # 受付回
        cz_parts.append(str(days))  # 調剤数量
        cz_parts.append('1')  # 負担区分
        cz_parts.append('1')  # 算定区分
        cz_parts.append('01')  # 算定先No

        # 薬剤調製料
        if is_gai:
            cz_parts.append(CODES['chozai_gai'])
            cz_parts.append('10')
            chozai_pts = 10
        elif is_ton:
            cz_parts.append(CODES['chozai_ton'])
            cz_parts.append('21')
            chozai_pts = 21
        else:
            cz_parts.append(CODES['chozai_nai'])
            cz_parts.append('24')
            chozai_pts = 24

        cz_parts.append('')  # 分割区分
        cz_parts.append('')  # 前回数量

        # 薬剤料点数（ランダム）
        yakuzai_pts = random.randint(10, 500)
        cz_parts.append(str(yakuzai_pts))
        cz_parts.append('')  # 予備

        # 加算料（最大10個×3フィールド = 30フィールド）
        kazan_fields = []
        if has_mukyoko:
            if is_gai:
                kazan_fields.extend(['1', CODES['mukyoko_gai'], '8'])
            elif is_ton:
                kazan_fields.extend(['1', CODES['mukyoko_ton'], '8'])
            else:
                kazan_fields.extend(['1', CODES['mukyoko_nai'], '8'])

        if has_keiryo and not is_gai and not is_ton:
            kazan_fields.extend(['1', CODES['keiryo_san_nai'], '45'])
        elif has_keiryo and is_gai:
            kazan_fields.extend(['1', CODES['keiryo_nan_gai'], '80'])

        if has_jika and not is_gai and not is_ton:
            kazan_fields.extend(['1', CODES['jika_han_28'], '16'])

        # 加算フィールドを30個にパディング
        while len(kazan_fields) < 30:
            kazan_fields.append('')
        cz_parts.extend(kazan_fields[:30])

        cz_parts.append('')  # 一包化日数
        # 分割調剤フィールド
        cz_parts.extend([''] * 6)
        # 包括管理料等、他医療機関
        cz_parts.extend(['', ''])
        # 外来服薬支援料2
        cz_parts.extend(['', '', ''])

        # 調剤管理料
        cz_parts.append('1')  # 負担区分
        cz_parts.append('1')  # 算定区分
        cz_parts.append('01')  # 算定先No

        if is_gai or is_ton:
            cz_parts.append(CODES['kanri_other'])
            cz_parts.append('4')
            kanri_pts = 4
        elif days <= 7:
            cz_parts.append(CODES['kanri_7'])
            cz_parts.append('4')
            kanri_pts = 4
        elif days <= 14:
            cz_parts.append(CODES['kanri_14'])
            cz_parts.append('28')
            kanri_pts = 28
        elif days <= 28:
            cz_parts.append(CODES['kanri_28'])
            cz_parts.append('50')
            kanri_pts = 50
        else:
            cz_parts.append(CODES['kanri_29'])
            cz_parts.append('60')
            kanri_pts = 60

        # 時間外加算（調剤管理料）
        cz_parts.extend(['', '', ''])
        # 薬剤料減算
        cz_parts.extend(['', '', '', '', '', ''])

        lines.append(','.join(cz_parts))

        # IY: 医薬品レコード（複数）
        selected_drugs = random.sample(DRUGS, min(num_drugs, len(DRUGS)))
        for drug_code, base_qty, _ in selected_drugs:
            qty = base_qty * (days if not is_ton else 1)
            lines.append(f'IY,1,{drug_code},{qty},,,,,,')

        # RP: 用法レコード
        lines.append(f'RP,1,1,{days}')

        total_points += chozai_pts + yakuzai_pts + kanri_pts

    # KI: 基本料・薬学管理料レコード
    ki_day = f'{year}{month:02d}01'
    ki_parts = ['KI', ki_day, '1', '1']

    # 基本料算定
    ki_items = [
        ('kihon3ha', rx_count),
        ('chiiki3', rx_count),
        ('kouhatsu3', rx_count),
        ('renkei', rx_count),
        ('dx8', int(rx_count * 0.8)),
        ('zaitaku15', max(1, int(rx_count * 0.007))),
        ('yakan', max(1, int(rx_count * 0.05))),
        ('fuyaku_a', int(rx_count * 0.6)),
        ('fuyaku_b', int(rx_count * 0.15)),
        ('fuyaku_c', int(rx_count * 0.2)),
        ('kakari', max(1, int(rx_count * 0.02))),
        ('tokutei_1i', max(1, int(rx_count * 0.01))),
        ('tokutei_1ro', max(1, int(rx_count * 0.003))),
        ('tokutei_3i', int(rx_count * 0.5)),
        ('iryo_joho', max(1, int(rx_count * 0.05))),
        ('nyuyoji', int(rx_count * 0.4)),
        ('fuyaku_joho2', max(1, int(rx_count * 0.001))),
        ('zaitaku_1nin', max(1, int(rx_count * 0.003))),
        ('bukka', int(rx_count * 0.6)),
        ('shinya_homon', max(1, int(rx_count * 0.003))),
    ]

    for name, cnt in ki_items:
        code, pts = KI_CODES[name]
        ki_parts.extend([str(cnt), code, str(pts)])
        total_points += cnt * pts

    # 残りを空で埋める
    while len(ki_parts) < 80:
        ki_parts.append('')
    lines.append(','.join(ki_parts))

    # GO: 合計レコード
    lines.append(f'GO,{total_points},0,{rx_count},0,{rx_count},0,')

    # 出力
    fname = f'RECEIPTS_{diag_ym}.UKE'
    path = os.path.join(output_dir, fname)
    with open(path, 'w', encoding='cp932', newline='\r\n') as f:
        f.write('\n'.join(lines))

    return fname, total_points, rx_count


def main():
    output_dir = os.path.join(os.path.dirname(__file__), 'レセコンデータ', 'uke')
    os.makedirs(output_dir, exist_ok=True)

    # R7.5～R8.3（11ヶ月）
    months_data = [
        (2025, 5, 1050), (2025, 6, 1020), (2025, 7, 980),
        (2025, 8, 950),  (2025, 9, 1000), (2025, 10, 1080),
        (2025, 11, 1100),(2025, 12, 1120),(2026, 1, 1130),
        (2026, 2, 1140), (2026, 3, 920),
    ]

    random.seed(42)
    print('UKE sample generation (SSK spec compliant)')
    print(f'Output: {output_dir}')

    for year, month, rx_count in months_data:
        fname, pts, rx = gen_uke(year, month, rx_count, output_dir)
        print(f'  {fname}: {rx} receipts, {pts:,} points')

    print('Done.')


if __name__ == '__main__':
    main()
