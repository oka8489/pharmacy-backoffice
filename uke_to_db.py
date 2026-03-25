#!/usr/bin/env python3
"""UKEファイル + 薬価マスタ → SQLite DB 変換スクリプト"""
import sqlite3
import csv
import os
import sys
import glob
import json
import re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'migiude.db')
UKE_DIR = os.path.join(BASE_DIR, 'レセコンデータ', 'uke')
MASTER_DIR = os.path.join(BASE_DIR, 'master')
EXPORT_PATH = os.path.join(BASE_DIR, 'db_export.json')


def init_db(conn):
    """テーブル作成"""
    c = conn.cursor()
    c.executescript('''
        CREATE TABLE IF NOT EXISTS drugs (
            code TEXT PRIMARY KEY,
            name TEXT, kana TEXT, unit TEXT, price REAL,
            generic INTEGER, narcotic INTEGER, poison INTEGER,
            stimulant INTEGER, stimulant_raw INTEGER, psychotropic INTEGER,
            yakka_code TEXT, generic_name TEXT
        );
        CREATE TABLE IF NOT EXISTS procedures (
            code TEXT PRIMARY KEY,
            name TEXT, kana TEXT, points REAL, category TEXT
        );
        CREATE TABLE IF NOT EXISTS monthly_summary (
            year_month TEXT PRIMARY KEY,
            pharmacy_name TEXT, total_points INTEGER,
            rx_count INTEGER, rx_sheets INTEGER
        );
        CREATE TABLE IF NOT EXISTS monthly_kasan (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year_month TEXT, procedure_code TEXT, procedure_name TEXT,
            points REAL, count INTEGER, amount REAL
        );
        CREATE TABLE IF NOT EXISTS monthly_drugs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year_month TEXT, drug_code TEXT, drug_name TEXT,
            unit TEXT, price REAL, total_quantity REAL,
            total_points INTEGER, count INTEGER, generic INTEGER
        );
        CREATE TABLE IF NOT EXISTS monthly_chozai (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year_month TEXT,
            dosage_form TEXT,
            chozai_code TEXT, chozai_points INTEGER, chozai_count INTEGER,
            kanri_code TEXT, kanri_points INTEGER, kanri_count INTEGER,
            days INTEGER,
            kazan_codes TEXT,
            yakuzai_points INTEGER
        );
    ''')
    conn.commit()


def load_drug_master(conn):
    """薬価マスタCSVをDBに読み込む"""
    c = conn.cursor()
    existing = c.execute('SELECT COUNT(*) FROM drugs').fetchone()[0]
    if existing > 0:
        print(f'  薬価マスタ: 既に{existing:,}件あり（スキップ）')
        return

    csv_files = glob.glob(os.path.join(MASTER_DIR, 'y_*.csv'))
    if not csv_files:
        print('  薬価マスタCSVが見つかりません')
        return

    csv_path = sorted(csv_files)[-1]  # 最新版
    count = 0
    with open(csv_path, 'r', encoding='cp932') as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 25 or row[1] != 'Y':
                continue
            code = row[2].strip()
            name = row[4].strip()
            kana = row[6].strip()
            unit = row[9].strip()
            try:
                price = int(row[11]) * 0.1
            except:
                price = 0
            generic = int(row[23]) if row[23].isdigit() else 0
            narcotic = int(row[17]) if row[17].isdigit() else 0
            poison = int(row[18]) if row[18].isdigit() else 0
            stimulant = int(row[19]) if row[19].isdigit() else 0
            stimulant_raw = int(row[20]) if row[20].isdigit() else 0
            psychotropic = int(row[21]) if row[21].isdigit() else 0

            c.execute('INSERT OR REPLACE INTO drugs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
                      (code, name, kana, unit, price, generic, narcotic, poison,
                       stimulant, stimulant_raw, psychotropic, '', ''))
            count += 1

    conn.commit()
    print(f'  薬価マスタ: {count:,}件 読み込み完了')


def load_procedure_master(conn):
    """診療行為マスタCSVをDBに読み込む"""
    c = conn.cursor()
    existing = c.execute('SELECT COUNT(*) FROM procedures').fetchone()[0]
    if existing > 0:
        print(f'  診療行為マスタ: 既に{existing:,}件あり（スキップ）')
        return

    csv_files = glob.glob(os.path.join(MASTER_DIR, 's_*.csv'))
    if not csv_files:
        print('  診療行為マスタCSVが見つかりません')
        return

    csv_path = sorted(csv_files)[-1]
    count = 0
    with open(csv_path, 'r', encoding='cp932') as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 12 or row[1] != 'S':
                continue
            code = row[2].strip()
            name = row[4].strip()
            kana = row[6].strip() if len(row) > 6 else ''
            try:
                points = int(row[10]) * 0.1 if row[10].strip() else 0
            except:
                points = 0
            category = row[8].strip() if len(row) > 8 else ''

            c.execute('INSERT OR REPLACE INTO procedures VALUES (?,?,?,?,?)',
                      (code, name, kana, points, category))
            count += 1

    conn.commit()
    print(f'  診療行為マスタ: {count:,}件 読み込み完了')


def parse_uke(filepath, conn):
    """UKEファイルをパースしてDBに格納"""
    c = conn.cursor()

    pharmacy_name = ''
    billing_month = ''
    total_points = 0
    rx_count = 0
    kasan = {}  # code -> {count, points}
    drugs = {}  # code -> {quantity, points, count}
    chozai_records = []  # CZレコードのパース結果

    # レコード識別: 新UKEはcols[0]がレコード識別
    # 旧UKE(アフェットサンプル)はcols[3]がレコード識別
    # 自動判定する

    def detect_format(filepath):
        """UKEフォーマットを自動判定"""
        with open(filepath, 'r', encoding='cp932') as f:
            for line in f:
                cols = line.strip().split(',')
                if len(cols) >= 2:
                    if cols[0] in ('MN','YK','RE','HO','KI','GO','CZ','IY','SH','RP','SN','JD','MF','CO'):
                        return 'new'  # 新形式: cols[0]=レコード識別
                    if len(cols) > 3 and cols[3].strip() in ('MN','YK','RE','HO','KI','GO','CZ','IY'):
                        return 'old'  # 旧形式: cols[3]=レコード識別
        return 'new'  # デフォルト

    fmt = detect_format(filepath)

    with open(filepath, 'r', encoding='cp932') as f:
        for line in f:
            cols = line.strip().split(',')
            if len(cols) < 2:
                continue

            if fmt == 'old':
                rec = cols[3].strip() if len(cols) > 3 else ''
                col_offset = 4  # データはcols[4]以降
            else:
                rec = cols[0].strip()
                col_offset = 1  # データはcols[1]以降

            if rec == 'YK':
                if fmt == 'old':
                    pharmacy_name = cols[8].strip() if len(cols) > 8 else ''
                    billing_month = cols[9].strip() if len(cols) > 9 else ''
                else:
                    # YK,種別,都道府県,点数表,薬局コード,薬局名,請求年月,...
                    pharmacy_name = cols[5].strip() if len(cols) > 5 else ''
                    billing_month = cols[6].strip() if len(cols) > 6 else ''

            elif rec == 'GO':
                if fmt == 'old':
                    total_points = int(cols[4]) if len(cols) > 4 and cols[4].strip() else 0
                else:
                    total_points = int(cols[1]) if len(cols) > 1 and cols[1].strip() else 0

            elif rec == 'RE':
                rx_count += 1

            elif rec == 'KI':
                if fmt == 'old':
                    i = 7
                else:
                    # KI,算定日,負担者種別,負担区分, cnt,code,pts, cnt,code,pts,...
                    i = 4
                while i + 2 < len(cols):
                    cnt_str = cols[i].strip()
                    code = cols[i + 1].strip()
                    pts_str = cols[i + 2].strip()
                    cnt = int(cnt_str) if cnt_str.isdigit() else 0
                    pts = int(pts_str) if pts_str.isdigit() else 0
                    if code and len(code) == 9 and cnt > 0:
                        if code not in kasan:
                            kasan[code] = {'count': 0, 'points': 0}
                        kasan[code]['count'] += cnt
                        kasan[code]['points'] += pts * cnt
                    i += 3

            elif rec == 'CZ':
                # CZ: 調剤情報レコード（SSK仕様 71フィールド）
                # CZ,医師番号,処方月日,調剤月日,受付回,調剤数量,
                #    負担区分(調製),算定区分(調製),算定先No,コード(調製),点数(調製),
                #    分割区分,前回数量,点数(薬剤料),予備,
                #    負担区分(加算),コード(加算),点数(加算),...(x10)
                #    一包化日数,...
                #    負担区分(調剤管理料),算定区分,算定先No,コード(調剤管理料),点数(調剤管理料),...
                try:
                    days = int(cols[5]) if len(cols) > 5 and cols[5].strip() else 0
                    chozai_code = cols[9].strip() if len(cols) > 9 else ''
                    chozai_pts = int(cols[10]) if len(cols) > 10 and cols[10].strip() else 0
                    yakuzai_pts = int(cols[13]) if len(cols) > 13 and cols[13].strip() else 0

                    # 加算コード（cols[16],cols[17],cols[18], cols[19],cols[20],cols[21],...）
                    kazan_codes = []
                    for ki in range(15, min(45, len(cols)), 3):
                        kc = cols[ki + 1].strip() if ki + 1 < len(cols) else ''
                        kp = cols[ki + 2].strip() if ki + 2 < len(cols) else ''
                        if kc and len(kc) == 9:
                            kazan_codes.append(f'{kc}:{kp}')

                    # 調剤管理料（cols[58]〜cols[62]あたり）
                    kanri_code = ''
                    kanri_pts = 0
                    # 探索: 9桁コードで440011で始まるもの
                    for ci in range(55, min(66, len(cols))):
                        val = cols[ci].strip() if ci < len(cols) else ''
                        if val.startswith('44001'):
                            kanri_code = val
                            kanri_pts = int(cols[ci + 1]) if ci + 1 < len(cols) and cols[ci + 1].strip().isdigit() else 0
                            break

                    # 剤形判定
                    dosage = 'other'
                    if chozai_code.startswith('42000181'): dosage = 'naifuku'
                    elif chozai_code.startswith('42000241'): dosage = 'tonpuku'
                    elif chozai_code.startswith('42000251'): dosage = 'gaiyou'
                    elif chozai_code.startswith('42000261'): dosage = 'chusya'
                    elif chozai_code.startswith('42000201'): dosage = 'naiteki'

                    chozai_records.append({
                        'dosage': dosage, 'days': days,
                        'chozai_code': chozai_code, 'chozai_pts': chozai_pts,
                        'kanri_code': kanri_code, 'kanri_pts': kanri_pts,
                        'kazan_codes': ','.join(kazan_codes),
                        'yakuzai_pts': yakuzai_pts,
                    })
                except Exception:
                    pass

            elif rec == 'IY':
                # IY,負担区分,医薬品コード,使用量,予備,予備,混合区分コード,混合区分枝,配合不適,1回用量
                code = cols[2].strip() if len(cols) > 2 else ''
                qty_str = cols[3].strip() if len(cols) > 3 else '0'
                try:
                    qty = float(qty_str)
                except:
                    qty = 0
                if code and len(code) == 9 and code.startswith('6'):
                    if code not in drugs:
                        drugs[code] = {'quantity': 0, 'points': 0, 'count': 0}
                    drugs[code]['quantity'] += qty
                    drugs[code]['count'] += 1

    if not billing_month:
        return None

    # billing_monthは請求月（=診療月の翌月）→ 診療月に変換
    by = int(billing_month[:4])
    bm = int(billing_month[4:6]) - 1
    if bm == 0:
        bm = 12
        by -= 1
    year_month = f'{by}-{bm:02d}'

    # monthly_summary
    c.execute('INSERT OR REPLACE INTO monthly_summary VALUES (?,?,?,?,?)',
              (year_month, pharmacy_name, total_points, rx_count, rx_count))

    # monthly_kasan
    c.execute('DELETE FROM monthly_kasan WHERE year_month=?', (year_month,))
    for code, data in kasan.items():
        # 名前をproceduresマスタから取得
        row = c.execute('SELECT name, points FROM procedures WHERE code=?', (code,)).fetchone()
        if row:
            name, pts = row
        else:
            name = f'不明({code})'
            pts = data['points'] / data['count'] if data['count'] else 0

        amount = data['points'] * 10  # 1点=10円
        c.execute('INSERT INTO monthly_kasan (year_month, procedure_code, procedure_name, points, count, amount) VALUES (?,?,?,?,?,?)',
                  (year_month, code, name, pts, data['count'], amount))

    # monthly_drugs
    c.execute('DELETE FROM monthly_drugs WHERE year_month=?', (year_month,))
    for code, data in drugs.items():
        row = c.execute('SELECT name, unit, price, generic FROM drugs WHERE code=?', (code,)).fetchone()
        if row:
            name, unit, price, generic = row
        else:
            name, unit, price, generic = f'不明({code})', '', 0, 0

        c.execute('INSERT INTO monthly_drugs (year_month, drug_code, drug_name, unit, price, total_quantity, total_points, count, generic) VALUES (?,?,?,?,?,?,?,?,?)',
                  (year_month, code, name, unit, price, data['quantity'], data['points'], data['count'], generic))

    # monthly_chozai (CZレコード集計)
    c.execute('DELETE FROM monthly_chozai WHERE year_month=?', (year_month,))
    for cz in chozai_records:
        c.execute('''INSERT INTO monthly_chozai
            (year_month, dosage_form, chozai_code, chozai_points, chozai_count,
             kanri_code, kanri_points, kanri_count, days, kazan_codes, yakuzai_points)
            VALUES (?,?,?,?,1,?,?,1,?,?,?)''',
            (year_month, cz['dosage'], cz['chozai_code'], cz['chozai_pts'],
             cz['kanri_code'], cz['kanri_pts'], cz['days'],
             cz['kazan_codes'], cz['yakuzai_pts']))

    conn.commit()
    return year_month, total_points, rx_count, len(kasan), len(drugs), len(chozai_records)


def export_json(conn):
    """DB → JSON エクスポート（ブラウザ用）"""
    c = conn.cursor()
    export = {}

    # summary
    export['summary'] = []
    for row in c.execute('SELECT * FROM monthly_summary ORDER BY year_month'):
        export['summary'].append({
            'year_month': row[0], 'pharmacy': row[1],
            'total_points': row[2], 'rx_count': row[3], 'rx_sheets': row[4]
        })

    # kasan
    export['kasan'] = {}
    for row in c.execute('SELECT year_month, procedure_code, procedure_name, points, count, amount FROM monthly_kasan ORDER BY year_month, amount DESC'):
        ym = row[0]
        if ym not in export['kasan']:
            export['kasan'][ym] = []
        export['kasan'][ym].append({
            'code': row[1], 'name': row[2], 'points': row[3],
            'count': row[4], 'amount': row[5]
        })

    # drugs
    export['drugs'] = {}
    for row in c.execute('SELECT year_month, drug_code, drug_name, unit, price, total_quantity, total_points, count, generic FROM monthly_drugs ORDER BY year_month, count DESC'):
        ym = row[0]
        if ym not in export['drugs']:
            export['drugs'][ym] = []
        export['drugs'][ym].append({
            'code': row[1], 'name': row[2], 'unit': row[3], 'price': row[4],
            'qty': row[5], 'points': row[6], 'count': row[7], 'generic': row[8]
        })

    # chozai (CZ集計: 剤形別・日数区分別)
    export['chozai'] = {}
    for row in c.execute('''
        SELECT year_month, dosage_form,
            SUM(chozai_points) as chozai_total,
            SUM(kanri_points) as kanri_total,
            SUM(yakuzai_points) as yakuzai_total,
            COUNT(*) as count,
            -- 日数区分集計
            SUM(CASE WHEN days <= 7 THEN 1 ELSE 0 END) as d7,
            SUM(CASE WHEN days BETWEEN 8 AND 14 THEN 1 ELSE 0 END) as d14,
            SUM(CASE WHEN days BETWEEN 15 AND 28 THEN 1 ELSE 0 END) as d28,
            SUM(CASE WHEN days >= 29 THEN 1 ELSE 0 END) as d29
        FROM monthly_chozai
        GROUP BY year_month, dosage_form
        ORDER BY year_month, dosage_form
    '''):
        ym = row[0]
        if ym not in export['chozai']:
            export['chozai'][ym] = []
        export['chozai'][ym].append({
            'dosage': row[1], 'chozai_pts': row[2], 'kanri_pts': row[3],
            'yakuzai_pts': row[4], 'count': row[5],
            'days_7': row[6], 'days_14': row[7], 'days_28': row[8], 'days_29': row[9]
        })

    with open(EXPORT_PATH, 'w', encoding='utf-8') as f:
        json.dump(export, f, ensure_ascii=False)
    print(f'\nJSON出力: {EXPORT_PATH} ({os.path.getsize(EXPORT_PATH):,} bytes)')


def main():
    print('=== UKE → DB 変換 ===\n')

    conn = sqlite3.connect(DB_PATH)
    init_db(conn)

    # マスタ読み込み
    print('【マスタ読み込み】')
    load_drug_master(conn)
    load_procedure_master(conn)

    # UKEファイル処理
    print('\n【UKEファイル処理】')
    uke_files = sorted(glob.glob(os.path.join(UKE_DIR, '*.UKE')))
    if not uke_files:
        print('  UKEファイルが見つかりません')
        print(f'  → {UKE_DIR} にUKEファイルを置いてください')
        conn.close()
        return

    for uke_path in uke_files:
        fname = os.path.basename(uke_path)
        result = parse_uke(uke_path, conn)
        if result:
            ym, pts, rx, kasan_cnt, drug_cnt, cz_cnt = result
            print(f'  {fname} → {ym} | {pts:>10,}点 | {rx:>5,}件 | 加算{kasan_cnt}種 | 薬品{drug_cnt}種 | CZ{cz_cnt}件')
        else:
            print(f'  {fname} → パース失敗')

    # JSON出力
    export_json(conn)
    conn.close()
    print('\n完了！migiude.batで開いてください。')


if __name__ == '__main__':
    main()
