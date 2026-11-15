# Ocean Lab

A local browser interface for the microbe-matching algorithm in `main.py`.

## Run

Install Python 3.8 or newer, then run from this folder:

```powershell
python server.py
```

The app opens at http://127.0.0.1:8000. Keep the terminal running; Ctrl+C stops it. No third-party packages or internet connection are required. Alternatively, double-click `Start Ocean Lab.bat` on Windows. Use `python server.py --port 8001` if port 8000 is busy.

## Use

1. On the first screen, enter the ocean's **Attribute 1**, **Attribute 2** and **Attribute 3** ranges. There are always exactly three numeric attributes. Editing either endpoint automatically keeps the range width at two, as required by the original algorithm.
2. Enter your complete trait list, **one name per line**, and select **Apply trait list**. There is no fixed trait count; at least two distinct names are needed for the desired and excluded choices. Names may describe any trait, such as Light sensitive or Salt tolerant. Choose one desired trait and one different excluded trait, then select **Save and continue**.
3. The full-width microbe deck opens with your saved ocean conditions in a note at the top right. Select **Edit** on the note to change conditions without losing microbe entries.
4. Enter three values for each of the ten microbes. Select all applicable traits using the buttons labeled with your full trait names.
5. Select **Run match**. All allowed combinations appear in one table, from highest to lowest score. Combinations containing the excluded trait are removed before scoring. Each of five checks earns 20%: the three average ranges, presence of the desired trait, and absence of the excluded trait. Partial matches remain visible, even when the best available score is only 80% or 60%. Equal scores share a rank and follow microbe-number order. Each row shows passing and failing checks, rounded averages, and their exact fractions.

**Load example** fills the microbe cards using your configured traits while preserving your ocean conditions and trait list. Entries save automatically in this browser, including pending trait-list edits; **Clear all** resets them and returns to ocean setup. Reloading starts at ocean setup with saved entries restored. Older saved entries retain their original traits. When editing the list, unchanged names keep their selections; removed or renamed traits are cleared from ocean choices and microbe cards. Microbe names and numeric values are preserved. Changes invalidate old results so rerunning always checks current entries.

`server.py` calls `ranked_trios`, which uses exact fractional arithmetic and inclusive boundaries. Scores reflect the five equally weighted checks, not a probability. The original `valid_trios` function and `python main.py` command-line interface still return only fully compatible trios. The command-line interface asks for a comma-separated trait list before collecting conditions. API requests include `traitNames`; legacy requests without this field use the original list. Attribute check keys are `attribute1`, `attribute2`, and `attribute3`. The server listens only on this computer and serves only public UI files.

## Verify

```powershell
python -m unittest discover -s tests -v
node --test tests/test_model.js
node --check web/app.js
node --check web/model.js
```

For the frontend flow tests (simulated DOM, with a development-only dependency):

```powershell
npm ci --ignore-scripts
npm test
```

The app itself still runs without Node or third-party Python packages.
