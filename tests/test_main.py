import unittest
from fractions import Fraction
from main import Microbe, parse_category, parse_traits, valid_trios, validate_trait_names


class CommandLineAndCoreTests(unittest.TestCase):
    def test_custom_menu_numbers_and_multiple_traits(self):
        names = validate_trait_names(['Light sensitive', 'Salt tolerant'] + [f'Trait {i}' for i in range(10)])
        self.assertEqual(parse_category('12', names), 'Trait 9')
        self.assertEqual(parse_category('LIGHT-sensitive', names), 'Light sensitive')
        self.assertEqual(parse_traits('1, 12', names), frozenset(['Light sensitive', 'Trait 9']))
        for value in ['0', '13', 'Aerobic']:
            with self.assertRaises(ValueError):
                parse_category(value, names)

    def test_strict_solver_still_requires_all_five_conditions(self):
        microbes = [Microbe(i, (Fraction(5),)*3, frozenset(['Light sensitive'])) for i in range(1, 4)]
        intervals = [(Fraction(4), Fraction(6))]*3
        self.assertEqual(len(list(valid_trios(microbes, intervals, 'Light sensitive', 'Salt tolerant'))), 1)
        self.assertEqual(list(valid_trios(microbes, intervals, 'Missing', 'Salt tolerant')), [])
        self.assertEqual(list(valid_trios(microbes, intervals, 'Light sensitive', 'Light sensitive')), [])
        microbes[0].values = (Fraction('8.000000000000001'),)*3
        self.assertEqual(list(valid_trios(microbes, intervals, 'Light sensitive', 'Salt tolerant')), [])


if __name__ == '__main__':
    unittest.main()
