from flask import Flask, render_template, request, jsonify
import sqlite3
import pandas as pd

app = Flask(__name__)
db_location = "Frontier League.db"

fastballs = ['Fastball', 'Sinker', 'Cutter']
offspeed = ['Changeup', 'Splitter']
breaking = ['Slider', 'Curveball']

""" Pitcher Endpoints and Functions """


def get_pitchers(min_pitch_count=100):
    conn = sqlite3.connect(db_location)
    try:
        query = f"SELECT Pitcher, COUNT(*) as pitch_count FROM 'fl_pbp_23' GROUP BY Pitcher HAVING pitch_count >= {min_pitch_count}"
        pitchers_df = pd.read_sql_query(query, conn).dropna(subset=['Pitcher'])
        return pitchers_df['Pitcher'].tolist()
    finally:
        conn.close()


pitchers = get_pitchers(300)


def get_pitch_data(selected_pitcher):
    conn = sqlite3.connect(db_location)
    try:
        query = f"SELECT * FROM 'fl_pbp_23' WHERE Pitcher = ?"
        pitches_df = pd.read_sql_query(
            query, conn, params=[selected_pitcher]).sort_values('Date', ascending=True)
        return pitches_df
    finally:
        conn.close()


def calculate_pitch_distribution(pitches_df):
    pitch_distribution = {}
    unique_pitch_names = pitches_df[~pitches_df.AutoPitchType.isna(
    )].AutoPitchType.unique()

    for pitch_name in unique_pitch_names:
        pitch_count = (pitches_df['AutoPitchType'] == pitch_name).sum()
        pitch_percentage = pitch_count / len(pitches_df) * 100
        pitch_distribution[pitch_name] = {
            'percentage': pitch_percentage, 'count': pitch_count}

    sorted_pitch_distribution = dict(
        sorted(pitch_distribution.items(),
               key=lambda item: item[1]['percentage'], reverse=True)
    )
    return sorted_pitch_distribution


def categorize_pitch_group(pitch_type):
    if pitch_type in fastballs:
        return 'Fastball'
    elif pitch_type in breaking:
        return 'Breaking'
    elif pitch_type in offspeed:
        return 'Offspeed'


@app.route('/pitch_summary', methods=['POST'])
def pitch_summary():
    selected_pitcher = request.form.get('Pitcher')
    pitches_df = get_pitch_data(selected_pitcher)
    pitch_distribution = calculate_pitch_distribution(pitches_df)

    summary_sentence = f"<strong>{selected_pitcher}</strong> relies on {len(pitch_distribution)} pitches. "

    for pitch_name, info in pitch_distribution.items():
        formatted_percentage = f"{info['percentage']:.1f}%"
        formatted_count = f"{info['count']:,}"
        summary_sentence += (f"<span class='{pitch_name}'> {pitch_name} ({formatted_percentage}, {formatted_count} "
                             f"pitches)</span>")

    team = pitches_df['PitcherTeam'].iloc[-1]
    hand = 'RHP' if pitches_df['PitcherThrows'].iloc[0] == 'Right' else 'LHP'
    team_hand = hand + ', ' + team

    return jsonify({'summary': summary_sentence.strip(), 'teamAndHand': team_hand})


@app.route('/update_pitcher_table', methods=['POST'])
def update_pitcher_table():
    selected_pitcher = request.form.get('Pitcher')

    with sqlite3.connect(db_location) as conn:
        query = f"SELECT * FROM 'fl_pbp_23' WHERE Pitcher = '{selected_pitcher}'"
        pitches_df = pd.read_sql_query(query, conn)

        pitch_stats = pitches_df.groupby('AutoPitchType')[
            ['RelSpeed', 'SpinRate', 'HorzBreak', 'InducedVertBreak', 'ExitSpeed',
             'Angle']].mean().reset_index().dropna()

        data = pitch_stats.to_dict(orient='records')

    return jsonify({'success': True, 'data': data})


@app.route('/update_pitcher_stats', methods=['POST'])
def update_pitcher_stats():
    try:
        selected_pitcher = request.form.get('Pitcher')

        with sqlite3.connect(db_location) as conn:
            query = "SELECT * FROM pitching_bref WHERE Name = ?"
            pitches_df = pd.read_sql_query(
                query, conn, params=(selected_pitcher,)).dropna()

        if not pitches_df.empty:
            data = pitches_df.to_dict(orient='records')
            return jsonify({'success': True, 'data': data})
        else:
            return jsonify({'success': False, 'message': 'No data found for the selected pitcher'})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


@app.route('/update_pitch_chart', methods=['POST'])
def update_pitch_chart():
    selected_pitcher = request.form.get('Pitcher')

    with sqlite3.connect(db_location) as conn:
        query = f"SELECT AutoPitchType, InducedVertBreak, HorzBreak FROM 'fl_pbp_23' WHERE Pitcher = '{selected_pitcher}'"
        pitches_df = pd.read_sql_query(query, conn)

    pitch_counts = pitches_df['AutoPitchType'].value_counts()
    selected_pitches = pitch_counts[pitch_counts >= 15].index
    pitches_df = pitches_df[pitches_df['AutoPitchType'].isin(selected_pitches)]

    chart_data = pitches_df[['AutoPitchType', 'InducedVertBreak', 'HorzBreak']].dropna(
        subset=['AutoPitchType', 'InducedVertBreak', 'HorzBreak']).to_dict(
        orient='records')

    return jsonify({'success': True, 'data': chart_data})


@app.route('/update_pitcher_percentiles', methods=['POST'])
def update_pitcher_percentiles():
    with sqlite3.connect(db_location) as conn:
        selected_pitcher = request.form.get('Pitcher')
        query = f"SELECT * FROM 'fl_savant_stats' WHERE Name = '{selected_pitcher}'"
        savant = pd.read_sql_query(query, conn).dropna()

    return jsonify({'success': True, 'data': savant.to_dict(orient='records')})


@app.route('/update_yakker_pitcher', methods=['POST'])
def update_yakker_pitcher():
    with sqlite3.connect(db_location) as conn:
        selected_pitcher = request.form.get('Pitcher')
        query = f"SELECT * FROM 'yakker_23' WHERE Pitcher = '{selected_pitcher}'"
        yakker = pd.read_sql_query(query, conn).dropna()

    return jsonify({'success': True, 'data': yakker.to_dict(orient='records')})


@app.route('/update_rv_pitcher', methods=['POST'])
def update_rv_pitcher():
    with sqlite3.connect(db_location) as conn:
        selected_pitcher = request.form.get('Pitcher')
        query = f"SELECT * FROM 'run_value_23' WHERE Pitcher = '{selected_pitcher}'"
        rv = pd.read_sql_query(query, conn).dropna()

    return jsonify({'success': True, 'data': rv.to_dict(orient='records')})


@app.route('/pitcher')
def pitcher():
    return render_template('pitcher.html', pitchers=pitchers)


""" Hitter Endpoints and Functions """


def get_hitter_list(min_pitch_count=100):
    conn = sqlite3.connect(db_location)

    query = f"SELECT Batter, COUNT(*) as pitch_count FROM 'fl_pbp_23' GROUP BY Batter HAVING pitch_count >= {min_pitch_count}"

    hitters_df = pd.read_sql_query(query, conn).dropna(subset=['Batter'])

    conn.close()

    return hitters_df['Batter'].tolist()


hitters = get_hitter_list(100)


@app.route('/hit_summary', methods=['POST'])
def hit_summary():
    selected_batter_name = request.form.get('Hitter')
    conn = sqlite3.connect(db_location)

    query = f"SELECT * FROM 'fl_pbp_23' WHERE Batter = ?"
    hitter_df = pd.read_sql_query(query, conn, params=[
                                  selected_batter_name, ]).sort_values('Date', ascending=True)
    conn.close()

    batted_balls = get_batted_ball_stats(hitter_df)

    agg_hitter_df = hitter_df.groupby(['AutoPitchType', 'PitcherThrows'])['RV'].agg(
        ['mean', 'count']).reset_index()
    agg_hitter_df = agg_hitter_df.rename(
        columns={'mean': 'RV', 'count': 'pitch_count'})

    agg_hitter_df = agg_hitter_df[agg_hitter_df['pitch_count'] >= 20]
    agg_hitter_df = agg_hitter_df.sort_values('RV', ascending=False)

    best_pitch = agg_hitter_df.AutoPitchType.iloc[0]
    best_hand = agg_hitter_df.PitcherThrows.iloc[0]
    best_rv = agg_hitter_df.RV.max()

    worst_pitch = agg_hitter_df.AutoPitchType.iloc[-1]
    worst_hand = agg_hitter_df.PitcherThrows.iloc[-1]

    best_hand = 'left-handed' if best_hand == 'Left' else 'right-handed'
    worst_hand = 'left-handed' if worst_hand == 'Left' else 'right-handed'

    summary_sentence = (
        f"<p><strong>{selected_batter_name}</strong> is best against {best_hand} <span class='{best_pitch}'> {best_pitch}"
        f"s.</span> \n"
        f"He carries an RV/100 of {round(best_rv * 100, 1)} against them.</p>\n")

    if worst_pitch + worst_hand != best_pitch + best_hand:
        summary_sentence += f"He performs worst against {worst_hand} <span class='{worst_pitch}'> {worst_pitch}s.</span>"

    team = hitter_df['BatterTeam'].iloc[-1]
    hand = 'RHH' if hitter_df['BatterSide'].iloc[0] == 'Right' else (
        'LHH' if hitter_df['BatterSide'].iloc[0] == 'Left' else 'Switch Hitter')
    team_hand = hand + ', ' + team

    hitter_df['pitch_group'] = hitter_df['AutoPitchType'].apply(
        categorize_pitch_group)

    hitter_df['velo_quadrant'] = hitter_df.groupby('pitch_group')['RelSpeed'].transform(
        lambda x: pd.qcut(x, q=[0, 0.33, 0.66, 1.0], labels=['0-33%', '33-66%', '66-100%']))

    hitter_df['xwOBAcon_gb'] = hitter_df['xwOBAcon_gb'].astype(float)

    hitter_df = hitter_df.groupby(['pitch_group', 'velo_quadrant'], observed=False)['xwOBAcon_gb'].mean().unstack(
        fill_value=0).reset_index()

    columns_to_fill = ['0-33%', '33-66%', '66-100%']
    for column in columns_to_fill:
        hitter_df[column] = hitter_df[column].round(3).astype(str)

    return jsonify({'summary': summary_sentence.strip(), 'teamAndHand': team_hand, 'data': hitter_df.to_dict(orient='records'),
                    'batted_ball': batted_balls.to_dict(orient='records')})


@app.route('/update_hitter_stats', methods=['POST'])
def update_hitter_stats():
    try:
        selected_batter_name = request.form.get('Hitter')

        conn = sqlite3.connect(db_location)
        query = "SELECT * FROM hitting_bref WHERE Name = ?"
        hitter_df = pd.read_sql_query(
            query, conn, params=(selected_batter_name,))

        if not hitter_df.empty:
            data = hitter_df.to_dict(orient='records')
            return jsonify({'success': True, 'data': data})
        else:
            return jsonify({'success': False, 'message': 'No data found for the selected hitter'})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

    finally:
        conn.close()


@app.route('/update_hitter_sz', methods=['POST'])
def update_hitter_sz():
    selected_batter_name = request.form.get('Hitter')
    conn = sqlite3.connect(db_location)

    query = f"SELECT * FROM 'fl_pbp_23' WHERE Batter = '{selected_batter_name}'"
    pitches_df = pd.read_sql_query(query, conn)
    pitches_df['isSwing'] = pitches_df['PitchCall'].isin(
        ['StrikeSwinging', 'Foul', 'FoulTip', 'CatchersInt', 'InPlay'])

    pitches_df = pitches_df[(pitches_df['PlateLocSide'] >= -1) &
                    (pitches_df['PlateLocSide'] <= 1)]
    pitches_df = pitches_df[(pitches_df['PlateLocHeight'] <= 3.5) &
                    (pitches_df['PlateLocHeight'] >= 1.5)]

    chart_data = pitches_df[['PlateLocSide', 'PlateLocHeight', 'xwOBAcon_gb', 'PlayResult']].dropna(
        subset=['PlateLocSide', 'PlateLocHeight', 'xwOBAcon_gb', 'PlayResult'])

    return jsonify({'success': True, 'data': chart_data.to_dict(
        orient='records')})


def get_batted_ball_stats(fl):
    bb = fl.copy().dropna(
        subset=['Direction', 'BatterSide', 'Angle', 'ExitSpeed'])
    bb['BatterSide'] = bb.apply(
        lambda row: 'Right' if row['BatterSide'] == 'Switch' and row['PitcherThrows'] == 'Left' else 'Left' if
        row['BatterSide'] == 'Switch' else row['BatterSide'], axis=1)

    bb['HitType'] = pd.cut(bb['Angle'], bins=[-float('inf'), 10, 25, 50, float('inf')],
                           labels=['Ground ball', 'Line drive', 'Fly ball', 'Pop up'], right=False)

    bb['isPull'] = ((bb['BatterSide'] == 'Right') & (
        bb['Direction'] <= -15) | (bb['BatterSide'] == 'Left') & (bb['Direction'] >= 15))
    bb['isOppo'] = ((bb['BatterSide'] == 'Right') & (bb['Direction'] >= 15) | (
        bb['BatterSide'] == 'Left') & (bb['Direction'] <= -15))
    bb['isMiddle'] = (~bb['isPull']) & (~bb['isOppo'])

    z_scores = bb.groupby('Batter')['ExitSpeed'].transform(
        lambda x: (x - x.mean()) / x.std())
    bb['isHard'] = z_scores >= 1
    bb['isWeak'] = z_scores <= -1

    bb = bb.groupby(['Batter']).agg(
        Pitches=('Batter', 'count'),
        Pulls=('isPull', 'sum'),
        Oppos=('isOppo', 'sum'),
        Middles=('isMiddle', 'sum'),
        GroundBalls=('HitType', lambda x: (x == 'Ground ball').sum()),
        LineDrives=('HitType', lambda x: (x == 'Line drive').sum()),
        PopUps=('HitType', lambda x: (x == 'Pop up').sum()),
        FlyBalls=('HitType', lambda x: (x == 'Fly ball').sum()),
        Hards=('isHard', 'sum'),
        Weaks=('isWeak', 'sum'),
    ).reset_index().dropna()

    bb['Pull%'] = bb['Pulls'] / bb['Pitches']
    bb['Oppo%'] = bb['Oppos'] / bb['Pitches']
    bb['Straight%'] = bb['Middles'] / bb['Pitches']
    bb['GroundBall%'] = bb['GroundBalls'] / bb['Pitches']
    bb['LineDrive%'] = bb['LineDrives'] / bb['Pitches']
    bb['PopUp%'] = bb['PopUps'] / bb['Pitches']
    bb['FlyBall%'] = bb['FlyBalls'] / bb['Pitches']
    bb['Solid%'] = bb['Hards'] / bb['Pitches']
    bb['Weak%'] = bb['Weaks'] / bb['Pitches']

    bb = bb.drop(
        ['Pulls', 'Oppos', 'Middles', 'GroundBalls', 'LineDrives',
            'PopUps', 'FlyBalls', 'Hards', 'Weaks', 'Pitches'],
        axis=1)

    return bb


@app.route('/update_hitter_percentiles', methods=['POST'])
def update_hitter_percentiles():
    conn = sqlite3.connect(db_location)
    selected_hitter_name = request.form.get('Hitter')
    query = f"SELECT * FROM 'fl_savant_stats_hit' WHERE Name = '{selected_hitter_name}'"
    savant = pd.read_sql_query(query, conn)
    conn.close()

    return jsonify({'success': True, 'data': savant.to_dict(orient='records')})


@app.route('/update_rv_hitter', methods=['POST'])
def update_rv_hitter():
    conn = sqlite3.connect(db_location)
    selected_hitter_name = request.form.get('Hitter')
    query = f"SELECT * FROM 'run_value_hit_23' WHERE Batter = '{selected_hitter_name}'"
    rv = pd.read_sql_query(query, conn).fillna(0).dropna()

    conn.close()

    return jsonify({'success': True, 'data': rv.to_dict(orient='records')})


@app.route('/update_discipline', methods=['POST'])
def update_discipline():
    conn = sqlite3.connect(db_location)
    selected_hitter_name = request.form.get('Hitter')
    query = f"SELECT * FROM 'discipline_23' WHERE Name = '{selected_hitter_name}'"
    discipline = pd.read_sql_query(query, conn)
    conn.close()

    return jsonify({'success': True, 'data': discipline.to_dict(orient='records')})


@app.route('/hitter')
def hitter():
    return render_template('hitter.html', hitters=hitters)


""" Catcher Endpoints and Functions """


def get_catcher_list(min_pitch_count=100):
    conn = sqlite3.connect(db_location)

    query = f"SELECT Catcher, COUNT(*) as pitch_count FROM 'fl_pbp_23' GROUP BY Catcher HAVING pitch_count >= {min_pitch_count}"

    catchers_df = pd.read_sql_query(query, conn).dropna(subset=['Catcher'])

    conn.close()

    return catchers_df['Catcher'].tolist()


catchers = get_catcher_list(0)


@app.route('/catcher')
def catcher():
    return render_template('catcher.html', catchers=catchers)


@app.route('/catch_summary', methods=['POST'])
def catch_summary():
    selected_catcher_name = request.form.get('Catcher')
    conn = sqlite3.connect(db_location)
    query = f"SELECT * FROM 'fl_pbp_23' WHERE Catcher = ?"
    catcher_df = pd.read_sql_query(query, conn, params=[
        selected_catcher_name, ]).sort_values('Date', ascending=True)
    team = catcher_df.CatcherTeam.iloc[-1]
    query = f"SELECT * FROM 'catchers_23'"
    catcher_df = pd.read_sql_query(query, conn)
    conn.close()

    one_catcher = catcher_df.copy()
    one_catcher = catcher_df[catcher_df['Catcher'] == selected_catcher_name]
    fr = one_catcher['Framing Runs'].iloc[0]
    desc = "added" if fr >= 0 else "lost"
    difference = abs(one_catcher['R-Strike%'].iloc[0] -
                     one_catcher['L-Strike%'].iloc[0])
    best_side = 'pitches to his left' if one_catcher['L-Strike%'].iloc[
        0] >= one_catcher['R-Strike%'].iloc[0] else 'pitches to his right'
    worst_side = 'pitches to his left' if one_catcher['L-Strike%'].iloc[
        0] < one_catcher['R-Strike%'].iloc[0] else 'pitches to his right'
    summary_sentence = f"<strong>{selected_catcher_name}</strong> has {desc} {fr} runs for his team on framing alone. <br><br>He frames {best_side} better than {worst_side} ({round(difference, 1)}% difference). "

    return jsonify({'team': team, 'summary': summary_sentence, 'leaderboard': catcher_df.to_dict(orient='records')})


@app.route('/catcher_leaderboard', methods=['POST'])
def catcher_leaderboard():
    conn = sqlite3.connect(db_location)
    query = f"SELECT * FROM 'catchers_23'"
    catcher_df = pd.read_sql_query(query, conn)
    conn.close()

    return jsonify({'leaderboard': catcher_df.to_dict(orient='records')})


@app.route('/catcher_data', methods=['POST'])
def catcher_data():
    selected_catcher_name = request.form.get('Catcher')
    conn = sqlite3.connect(db_location)
    query = f"SELECT * FROM 'fl_pbp_23' WHERE Catcher = ?"
    catcher_df = pd.read_sql_query(query, conn, params=[selected_catcher_name]).dropna(
        subset=['PlateLocSide', 'PlateLocHeight', 'PitchCall'])
    conn.close()

    strike_zone = {
        'x': [-1, 1, 1, -1, -1],
        'y': [1.5, 1.5, 3.5, 3.5, 1.5]
    }

    big_zone = {
        'x': [-1.35, 1.35, 1.35, -1.35, -1.35],
        'y': [1.35, 1.35, 3.65, 3.65, 1.35]
    }

    small_zone = {
        'x': [-0.65, 0.65, 0.65, -0.65, -0.65],
        'y': [1.65, 1.65, 3.35, 3.35, 1.65]
    }

    catcher_df = catcher_df[catcher_df['PitchCall'].isin(
        ['StrikeCalled', 'BallCalled'])]

    pitches_in_left = catcher_df[
        (catcher_df['PlateLocSide'] >= big_zone['x'][0]) &
        (catcher_df['PlateLocSide'] <= small_zone['x'][0]) &
        (catcher_df['PlateLocHeight'] <= strike_zone['y'][2]) &
        (catcher_df['PlateLocHeight'] >= strike_zone['y'][0])
    ]

    pitches_in_right = catcher_df[
        (catcher_df['PlateLocSide'] <= big_zone['x'][1]) &
        (catcher_df['PlateLocSide'] >= small_zone['x'][1]) &
        (catcher_df['PlateLocHeight'] <= strike_zone['y'][2]) &
        (catcher_df['PlateLocHeight'] >= strike_zone['y'][0])
    ]

    strike_total = pd.concat([pitches_in_left[pitches_in_left['PitchCall'] == 'StrikeCalled'],
                             pitches_in_right[pitches_in_right['PitchCall'] == 'StrikeCalled']])
    ball_total = pd.concat([pitches_in_left[pitches_in_left['PitchCall'] == 'BallCalled'],
                           pitches_in_right[pitches_in_right['PitchCall'] == 'BallCalled']])

    catcher_df = pd.concat([strike_total, ball_total])

    return jsonify({'data': catcher_df[['PitchCall', 'PlateLocSide', 'PlateLocHeight']].to_dict(orient='records')})


""" Umpire Endpoints and Functions """


def get_umpire_list(min_pitch_count=100):
    conn = sqlite3.connect(db_location)

    query = f"SELECT Umpire FROM 'umpires'"

    umps_df = pd.read_sql_query(query, conn).dropna(subset=['Umpire'])

    conn.close()

    return umps_df['Umpire'].dropna().tolist()


umpires = get_umpire_list(0)


@app.route('/umpire')
def umpire():
    return render_template('umpire.html', umpires=umpires)


@app.route('/ump_summary', methods=['POST'])
def ump_summary():
    selected_ump_name = request.form.get('Umpire')
    conn = sqlite3.connect(db_location)
    query = f"SELECT * FROM 'umpires'"
    ump_df = pd.read_sql_query(query, conn)
    conn.close()

    one_ump = ump_df.copy()
    one_ump = ump_df[ump_df['Umpire'] == selected_ump_name]
    accuracy = round(one_ump['Total Pitch Accuracy'].iloc[0], 1)
    pitches = one_ump['Pitches'].iloc[0]
    zaa = round(one_ump['Zone Above Average'].iloc[0] * 12, 1)
    desc = "bigger" if zaa > 0 else "smaller"
    gender_1 = "he" if selected_ump_name != 'Tanya Millette' else "she"
    gender_2 = "His" if selected_ump_name != 'Tanya Millette' else "Her"

    summary_sentence = f"<strong>{selected_ump_name}'s</strong> total pitch accuracy is {accuracy}%. Since umpire data has been tracked, {gender_1} has called {pitches} pitches. <br><br>{gender_2} zone size is {zaa} inches {desc} than the average FL ump."

    return jsonify({'summary': summary_sentence, })


@app.route('/ump_data', methods=['POST'])
def ump_data():
    selected_ump_name = request.form.get('Umpire')
    conn = sqlite3.connect(db_location)
    query = f"SELECT * FROM 'fl_pbp_23' WHERE Umpire = ?"
    ump_df = pd.read_sql_query(query, conn, params=[selected_ump_name]).dropna(
        subset=['PlateLocSide', 'PlateLocHeight', 'PitchCall'])
    conn.close()

    ump_df = ump_df[ump_df['PitchCall'].isin(
        ['StrikeCalled', 'BallCalled'])]

    ump_df = ump_df[(ump_df['PlateLocSide'] >= -1.3) &
                    (ump_df['PlateLocSide'] <= 1.3)]
    ump_df = ump_df[(ump_df['PlateLocHeight'] <= 3.8) &
                    (ump_df['PlateLocHeight'] >= 1.3)]

    return jsonify({'data': ump_df[['PitchCall', 'PlateLocSide', 'PlateLocHeight']].to_dict(orient='records')})

@app.route('/ump_leaderboard', methods=['POST'])
def ump_leaderboard():
    conn = sqlite3.connect(db_location)
    query = f"SELECT * FROM 'umpires'"
    ump_df = pd.read_sql_query(query, conn).sort_values('Total Pitch Accuracy', ascending=False)
    conn.close()

    return jsonify({'leaderboard': ump_df.to_dict(orient='records')})

@app.route('/')
def index():
    return render_template('index.html')
