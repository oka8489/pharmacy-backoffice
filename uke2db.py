#!/usr/bin/env python3
"""UKEファイル＋マスタ → SQLite DB 変換スクリプト"""
import sqlite3, csv, os, sys, glob, re

BASE = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE, 'migiude.db')
MASTER_DIR = os.path.join(BASE, 'master')

def init_db(conn):
    """テーブル作成"""
    c = conn.cursor()
    # 薬価マスタ
    c.execute('''CREATE TABLE IF NOT EXISTS drugs (
        code TEXT PRIMARY KEY,
        name TEXT,
        kana TEXT,
        unit TEXT,
        price REAL,
        generic INTEGER,
        narcotic INTEGER,
        poison INTEGER,
        stimulant INTEGER,
        stimulant_raw INTEGER,
        psychotropic INTEGER,
        yakka_code TEXT,
        generic_name TEXT
    )''')
    # 診療行為マスタ
    c.execute('''CREATE TABLE IF NOT EXISTS procedures (
        code TEXT PRIMARY KEY,
        name TEXT,
        kana TEXT,
        points REAL,
        category TEXT
    )''')
    # 月次サマリ
    c.execute('''CREATE TABLE IF NOT EXISTS monthly_summary (
        year_month TEXT PRIMARY KEY,
        pharmacy_name TEXT,
        total_points INTEGER,
        rx_count INTEGER,
        rx_sheets INTEGER
    )''')
    # 基本料・加算明細（KIレコード）
    c.execute('''CREATE TABLE IF NOT EXISTS monthly_kasan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year_month TEXT,
        procedure_code TEXT,
        procedure_name TEXT,
        points REAL,
        count INTEGER,
        amount REAL,
        UNIQUE(year_month, procedure_code)
    )''')
    # 調剤明細（JYレコード集計 - 患者情報なし）
    c.execute('''CREATE TABLE IF NOT EXISTS monthly_drugs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year_month TEXT,
        drug_code TEXT,
        drug_name TEXT,
        unit TEXT,
        price REAL,
        total_quantity REAL,
        total_points INTEGER,
        count INTEGER,
        generic INTEGER,
        UNIQUE(year_month, drug_code)
    )''')
    conn.commit()


def load_drug_master(conn):
    """薬価マスタCSVをDBに格納"""
    csv_files = glob.glob(os.path.join(MASTER_DIR, 'y_ALL*.csv'))
    if not csv_files:
        print('薬価マスタCSVが見つかりません')
        return 0
    csv_path = sorted(csv_files)[-1]  # 最新
    print(f'薬価マスタ読込: {os.path.basename(csv_path)}')

    c = conn.cursor()
    count = 0
    with open(csv_path, 'r', encoding='cp932') as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 25:
                continue
            code = row[2].strip('"')       # 医薬品コード(9桁)
            name = row[4].strip('"')       # 漢字名称
            kana = row[6].strip('"')       # カナ名称
            unit = row[9].strip('"')       # 単位名称
            price_raw = row[11].strip('"') # 金額(0.1円単位)
            try:
                price = float(price_raw) / 10.0
            except:
                price = 0
            generic = int(row[23].strip('"') or '0')     # 後発品
            narcotic = int(row[17].strip('"') or '0')    # 麻薬
            poison = int(row[18].strip('"') or '0')      # 毒薬
            stimulant = int(row[19].strip('"') or '0')   # 覚醒剤
            stimulant_raw = int(row[20].strip('"') or '0') # 覚醒剤原料
            psychotropic = int(row[21].strip('"') or '0')  # 向精神薬
            yakka_code = row[22].strip('"') if len(row) > 22 else ''
            generic_name = row[29].strip('"') if len(row) > 29 else ''

            c.execute('''INSERT OR REPLACE INTO drugs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                      (code, name, kana, unit, price, generic, narcotic, poison,
                       stimulant, stimulant_raw, psychotropic, yakka_code, generic_name))
            count += 1
    conn.commit()
    print(f'  → {count:,}品目')
    return count


def load_procedure_master(conn):
    """診療行為マスタCSVをDBに格納"""
    csv_files = glob.glob(os.path.join(MASTER_DIR, 's_ALL*.csv'))
    if not csv_files:
        print('診療行為マスタCSVが見つかりません')
        return 0
    csv_path = sorted(csv_files)[-1]
    print(f'診療行為マスタ読込: {os.path.basename(csv_path)}')

    c = conn.cursor()
    count = 0
    with open(csv_path, 'r', encoding='cp932') as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 12:
                continue
            code = row[2].strip('"')       # コード
            name = row[4].strip('"')       # 名称
            kana = row[6].strip('"')       # カナ
            try:
                points = float(row[11].strip('"'))
            except:
                points = 0
            category = row[14].strip('"') if len(row) > 14 else ''

            c.execute('''INSERT OR REPLACE INTO procedures VALUES (?,?,?,?,?)''',
                      (code, name, kana, points, category))
            count += 1
    conn.commit()
    print(f'  → {count:,}行為')
    return count


def parse_uke(conn, uke_path):
    """UKEファイルをパースしてDBに格納（患者情報は除外）"""
    c = conn.cursor()
    fname = os.path.basename(uke_path)
    print(f'UKE解析: {fname}')

    year_month = ''
    pharmacy_name = ''
    total_points = 0
    rx_count = 0
    ki_items = []  # 加算明細
    jy_items = {}  # 薬品集計 {drug_code: {qty, points, count}}

    with open(uke_path, 'r', encoding='cp932') as f:
        for line in f:
            parts = line.strip().split(',')
            if len(parts) < 4:
                continue
            rec_type = parts[3]

            if rec_type == 'YK':
                # 薬局情報
                pharmacy_name = parts[8] if len(parts) > 8 else ''
                ym_raw = parts[9] if len(parts) > 9 else ''
                # 請求年月 YYYYMM → YYYY-MM（前月分）
                if ym_raw and len(ym_raw) == 6:
                    y = int(ym_raw[:4])
                    m = int(ym_raw[4:6])
                    # 請求年月の前月が調剤月
                    m -= 1
                    if m == 0:
                        m = 12
                        y -= 1
                    year_month = f'{y}-{m:02d}'

            elif rec_type == 'GO':
                # 合計
                total_points = int(parts[4]) if len(parts) > 4 else 0
                rx_count = int(parts[7]) if len(parts) > 7 else 0
                rx_sheets = int(parts[7]) if len(parts) > 7 else 0

            elif rec_type == 'KI':
                # 基本料・加算内訳
                # KI,seq,0,KI,date,type,subtype,rx_count,code1,points1,count1,code2,points2,count2,...
                i = 8
                while i + 2 < len(parts):
                    code = parts[i].strip()
                    pts = parts[i+1].strip()
                    cnt = parts[i+2].strip() if i+2 < len(parts) else ''
                    if code and pts:
                        try:
                            ki_items.append({
                                'code': code,
                                'points': float(pts),
                                'count': int(cnt) if cnt else 1
                            })
                        except:
                            pass
                    i += 3

            elif rec_type == 'JY':
                # 調剤明細（患者情報なし、薬品コードのみ集計）
                drug_code = parts[4] if len(parts) > 4 else ''
                qty_raw = parts[5] if len(parts) > 5 else '0'
                pts = parts[6] if len(parts) > 6 else '0'

                if drug_code and drug_code.startswith('6'):
                    try:
                        qty = float(qty_raw) / 100.0 if qty_raw else 0
                    except:
                        qty = 0
                    try:
                        points = int(pts) if pts else 0
                    except:
                        points = 0

                    if drug_code not in jy_items:
                        jy_items[drug_code] = {'qty': 0, 'points': 0, 'count': 0}
                    jy_items[drug_code]['qty'] += qty
                    jy_items[drug_code]['points'] += points
                    jy_items[drug_code]['count'] += 1

    if not year_month:
        # ファイル名から推定
        m = re.search(r'(\d{6})', fname)
        if m:
            ym = m.group(1)
            year_month = f'{ym[:4]}-{ym[4:6]}'

    print(f'  期間: {year_month}, 薬局: {pharmacy_name}')
    print(f'  総点数: {total_points:,}, 処方箋: {rx_count:,}')
    print(f'  加算: {len(ki_items)}件, 薬品: {len(jy_items)}品目')

    # monthly_summary
    c.execute('''INSERT OR REPLACE INTO monthly_summary VALUES (?,?,?,?,?)''',
              (year_month, pharmacy_name, total_points, rx_count, rx_count))

    # monthly_kasan（コード→名称変換）
    for item in ki_items:
        row = c.execute('SELECT name, points FROM procedures WHERE code=?', (item['code'],)).fetchone()
        name = row[0] if row else f'不明({item["code"]})'
        amount = item['points'] * item['count'] * 10  # 点数×件数×10円
        c.execute('''INSERT OR REPLACE INTO monthly_kasan (year_month, procedure_code, procedure_name, points, count, amount)
                     VALUES (?,?,?,?,?,?)''',
                  (year_month, item['code'], name, item['points'], item['count'], amount))

    # monthly_drugs（コード→名称変換）
    for drug_code, info in jy_items.items():
        row = c.execute('SELECT name, unit, price, generic FROM drugs WHERE code=?', (drug_code,)).fetchone()
        if row:
            name, unit, price, generic = row
        else:
            name, unit, price, generic = f'不明({drug_code})', '', 0, 0
        c.execute('''INSERT OR REPLACE INTO monthly_drugs (year_month, drug_code, drug_name, unit, price, total_quantity, total_points, count, generic)
                     VALUES (?,?,?,?,?,?,?,?,?)''',
                  (year_month, drug_code, name, unit, price, info['qty'], info['points'], info['count'], generic))

    conn.commit()
    return year_month


def main():
    print('=== migiude UKE→DB 変換 ===\n')

    conn = sqlite3.connect(DB_PATH)
    init_db(conn)

    # マスタ読込
    load_drug_master(conn)
    load_procedure_master(conn)

    # UKEファイル処理
    uke_dir = os.path.join(BASE, 'レセコンデータ', 'uke')
    if not os.path.isdir(uke_dir):
        # ダウンロードフォルダも探す
        alt_dirs = [
            'C:/Users/Patch01/Downloads/afet_uke_R75-R83_aligned',
        ]
        for d in alt_dirs:
            if os.path.isdir(d):
                uke_dir = d
                break

    uke_files = sorted(glob.glob(os.path.join(uke_dir, '*.UKE')))
    if not uke_files:
        uke_files = sorted(glob.glob(os.path.join(uke_dir, '*.uke')))

    if not uke_files:
        print(f'\nUKEファイルが見つかりません: {uke_dir}')
        conn.close()
        return

    print(f'\n{len(uke_files)}件のUKEファイルを処理\n')
    for uke_path in uke_files:
        parse_uke(conn, uke_path)

    # 確認
    c = conn.cursor()
    print('\n=== DB確認 ===')
    for table in ['drugs', 'procedures', 'monthly_summary', 'monthly_kasan', 'monthly_drugs']:
        count = c.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
        print(f'  {table}: {count:,}件')

    # 月次サマリ表示
    print('\n=== 月次サマリ ===')
    for row in c.execute('SELECT * FROM monthly_summary ORDER BY year_month'):
        ym, name, pts, rx, sheets = row
        print(f'  {ym}: {pts:,}点, {rx:,}枚')

    # 加算サンプル
    print('\n=== 加算サンプル（直近月） ===')
    latest = c.execute('SELECT year_month FROM monthly_summary ORDER BY year_month DESC LIMIT 1').fetchone()
    if latest:
        for row in c.execute('SELECT procedure_name, points, count, amount FROM monthly_kasan WHERE year_month=? ORDER BY amount DESC LIMIT 10', (latest[0],)):
            print(f'  {row[0]}: {row[1]}点×{row[2]}件 = ¥{row[3]:,.0f}')

    # 薬品サンプル
    print('\n=== 使用薬品TOP10（直近月） ===')
    if latest:
        for row in c.execute('SELECT drug_name, price, total_quantity, count, generic FROM monthly_drugs WHERE year_month=? ORDER BY count DESC LIMIT 10', (latest[0],)):
            ge = '(GE)' if row[4] else ''
            print(f'  {row[0]}{ge}: ¥{row[1]:.1f} × {row[2]:.1f} = {row[3]}回')

    conn.close()
    print(f'\n完了: {DB_PATH}')


if __name__ == '__main__':
    main()
