import copy
import unittest
from server import solve
from main import ATTRIBUTES, CATEGORIES


class SolverTests(unittest.TestCase):
    def setUp(self):
        self.data = {
            "ranges": [["4", "6"] for _ in range(3)],
            "desired": "Aerobic", "undesired": "Heat Resistant",
            "microbes": [
                {"values": ["4", "4", "4"], "traits": ["Aerobic"]},
                {"values": ["5", "5", "5"], "traits": ["Hydrophilic"]},
                {"values": ["6", "6", "6"], "traits": ["Pressure Resistant"]},
            ] + [{"values": ["5", "5", "5"], "traits": ["Heat Resistant"]} for _ in range(7)]
        }

    def test_original_solver_and_excluded_traits(self):
        result = solve(self.data)
        self.assertEqual(result["eligible"], 3)
        self.assertEqual(len(result["matches"]), 1)
        match = result["matches"][0]
        self.assertEqual(match["ids"], [1, 2, 3])
        self.assertEqual(match["averages"], ["5"] * 3)
        self.assertEqual(match["carriers"], [1])
        self.assertEqual(match["score"], 100)
        self.assertTrue(all(match["checks"].values()))
        self.assertEqual(result["excluded_ids"], list(range(4, 11)))

    def test_inclusive_exact_decimal_boundaries(self):
        self.data["ranges"] = [["0.1", "2.1"] for _ in range(3)]
        for value in ["0.1", "2.1"]:
            for row in self.data["microbes"][:3]:
                row["values"] = [value] * 3
            self.assertEqual(solve(self.data)["matches"][0]["score"], 100)
        self.data["microbes"][0]["values"][0] = "2.100000000000001"
        match = solve(self.data)["matches"][0]
        self.assertEqual(match["score"], 80)
        self.assertFalse(match["checks"]["attribute1"])

    def test_missing_desired_trait_is_partial_match(self):
        self.data["microbes"][0]["traits"] = ["Hydrophilic"]
        match = solve(self.data)["matches"][0]
        self.assertEqual(match["score"], 80)
        self.assertFalse(match["checks"]["desired"])

    def test_sixty_percent_is_best_available(self):
        self.data["microbes"][0]["values"] = ["40", "40", "4"]
        result = solve(self.data)
        self.assertEqual(result["best_score"], 60)
        self.assertEqual(result["matches"][0]["checks"], {
            "attribute1": False, "attribute2": False, "attribute3": True,
            "desired": True, "excluded": True})

    def test_ranked_best_first_with_stable_ties(self):
        self.data["microbes"][0]["values"] = ["40", "40", "40"]
        self.data["microbes"][3] = {"values": ["5"] * 3, "traits": ["Aerobic"]}
        matches = solve(self.data)["matches"]
        self.assertEqual([m["score"] for m in matches], [100, 40, 40, 40])
        self.assertEqual([m["ids"] for m in matches], [[2, 3, 4], [1, 2, 3], [1, 2, 4], [1, 3, 4]])

    def test_excluded_microbe_never_appears_even_with_desired_trait(self):
        self.data["microbes"][0]["traits"] = ["Aerobic", "Heat Resistant"]
        result = solve(self.data)
        self.assertEqual(result["matches"], [])
        self.assertIsNone(result["best_score"])
        self.assertEqual(result["eligible"], 2)

    def test_all_120_combinations_are_kept(self):
        for row in self.data["microbes"]:
            row["traits"] = ["Hydrophilic"]
            row["values"] = ["20"] * 3
        matches = solve(self.data)["matches"]
        self.assertEqual(len(matches), 120)
        self.assertEqual(len({tuple(m["ids"]) for m in matches}), 120)
        self.assertTrue(all(m["score"] == 20 for m in matches))

    def test_multiple_traits_and_stable_order(self):
        self.data["microbes"][3] = {"values": ["5"] * 3, "traits": ["Aerobic", "Hydrophilic"]}
        self.assertEqual([m["ids"] for m in solve(self.data)["matches"]], [[1, 2, 3], [1, 2, 4], [1, 3, 4], [2, 3, 4]])

    def test_invalid_inputs(self):
        mutations = [lambda d: d.update(desired="Heat Resistant"), lambda d: d.update(microbes=[]), lambda d: d["ranges"][0].__setitem__(1,"7"), lambda d: d["microbes"][0].update(traits=[]), lambda d: d["microbes"][0].update(values=["", "2", "3"]), lambda d: d["microbes"][0].update(traits=["Unknown"])]
        for mutate in mutations:
            with self.subTest(mutate=mutate):
                data=copy.deepcopy(self.data)
                mutate(data)
                with self.assertRaises(ValueError):
                    solve(data)

    def test_custom_catalogs_have_no_fixed_trait_count(self):
        for count in [2, 3, 5, 12, 100]:
            with self.subTest(count=count):
                data = copy.deepcopy(self.data)
                names = ["Light sensitive", "Salt tolerant"] + [f"Custom {i}" for i in range(count-2)]
                data.update(traitNames=names, desired=names[0], undesired=names[-1])
                for i, row in enumerate(data["microbes"]):
                    row["traits"] = [names[0] if i < 3 else names[-1]]
                result = solve(data)
                self.assertEqual(result["eligible"], 3)
                self.assertEqual(result["matches"][0]["ids"], [1, 2, 3])
                self.assertEqual(result["matches"][0]["score"], 100)
                self.assertEqual(result["scoring"]["checks"], [*ATTRIBUTES, "desired", "excluded"])

    def test_catalog_change_preserves_scores(self):
        expected = solve(self.data)
        mapping = dict(zip(CATEGORIES, ['Light sensitive', 'Salt tolerant', 'Cold resistant', 'Magnetic']))
        self.data['traitNames'] = list(mapping.values()) + ['Other', 'Another']
        for field in ['desired', 'undesired']:
            self.data[field] = mapping[self.data[field]]
        for row in self.data['microbes']:
            row['traits'] = [mapping[t] for t in row['traits']]
        self.assertEqual(solve(self.data), expected)

    def test_invalid_trait_catalogs(self):
        for names in [None, 'Light sensitive', [], ['Only one'], ['A', ''], ['A', 2],
                      ['A', {}], ['Light sensitive', 'light-SENSITIVE'], ['A', '___']]:
            with self.subTest(names=names), self.assertRaises(ValueError):
                solve({**self.data, 'traitNames': names})

    def test_explicit_catalog_rejects_old_or_unknown_selections(self):
        self.data['traitNames'] = ['Light sensitive', 'Salt tolerant']
        with self.assertRaises(ValueError):
            solve(self.data)
        self.data.update(desired='Light sensitive', undesired='Salt tolerant')
        with self.assertRaises(ValueError):
            solve(self.data)  # Microbes still contain old fixed traits.

    def test_exactly_three_attributes_required(self):
        for count in [0, 2, 4]:
            with self.subTest(count=count):
                data = copy.deepcopy(self.data)
                data['ranges'] = [['4', '6']] * count
                with self.assertRaises(ValueError):
                    solve(data)
                data = copy.deepcopy(self.data)
                data['microbes'][0]['values'] = ['5'] * count
                with self.assertRaises(ValueError):
                    solve(data)

    def test_trait_names_are_plain_strings_even_with_markup(self):
        desired, excluded = '<Light & "sensitive">', "Cold's resistance"
        self.data.update(traitNames=[desired, excluded], desired=desired, undesired=excluded)
        for i, row in enumerate(self.data['microbes']):
            row['traits'] = [desired if i < 3 else excluded]
        self.assertEqual(solve(self.data)['best_score'], 100)


if __name__ == "__main__":
    unittest.main()
