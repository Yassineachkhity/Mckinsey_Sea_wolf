"""Find three compatible microbes for an ocean site. Run with Python 3.8+."""

from dataclasses import dataclass
from difflib import get_close_matches
from fractions import Fraction
from itertools import combinations
import re


ATTRIBUTES = ("attribute1", "attribute2", "attribute3")
ATTRIBUTE_LABELS = ("Attribute 1", "Attribute 2", "Attribute 3")
# Used only to read entries saved before configurable trait lists were added.
CATEGORIES = ("Aerobic", "Hydrophilic", "Pressure Resistant", "Heat Resistant")


def normalize(text):
    """Compare names without case, whitespace, hyphens or underscores."""
    return re.sub(r"[\s_-]+", "", text.casefold())


def validate_trait_names(names):
    """Validate a user-defined catalog without imposing a fixed trait count."""
    if not isinstance(names, (list, tuple)) or len(names) < 2:
        raise ValueError("Enter at least two trait names for different desired and excluded traits.")
    if any(not isinstance(name, str) or not name.strip() for name in names):
        raise ValueError("Each trait needs a non-empty name.")
    cleaned = tuple(name.strip() for name in names)
    keys = [normalize(name) for name in cleaned]
    if any(not key for key in keys):
        raise ValueError("Each trait needs a non-empty name.")
    if len(set(keys)) != len(keys):
        raise ValueError("Trait names must be unique, ignoring case, spaces, hyphens and underscores.")
    return cleaned


def parse_category(text, categories=CATEGORIES):
    category_names = {normalize(name): name for name in categories}
    key = normalize(text)
    if key in category_names:
        return category_names[key]
    if text.strip().isdigit() and 1 <= int(text.strip()) <= len(categories):
        return categories[int(text.strip()) - 1]
    matches = get_close_matches(key, category_names, n=1, cutoff=0.65)
    hint = f" Did you mean '{category_names[matches[0]]}'?" if matches else ""
    raise ValueError("Unknown characteristic." + hint + " Enter its name or menu number.")


def parse_traits(text, categories=CATEGORIES):
    return frozenset(parse_category(part, categories) for part in text.split(","))


def read_value(prompt, parser):
    while True:
        try:
            return parser(input(prompt))
        except ValueError as error:
            print(error)


def parse_numbers(text, count):
    parts = text.replace(",", " ").split()
    if len(parts) != count:
        raise ValueError(f"Enter {count} numbers separated by spaces or commas.")
    try:
        return tuple(Fraction(part) for part in parts)
    except (ValueError, ZeroDivisionError):
        raise ValueError("Enter valid numbers, for example 8 or 8.5.") from None


def parse_interval(text):
    low, high = parse_numbers(text, 2)
    if high - low != 2:
        raise ValueError("Enter the lower endpoint first and the upper endpoint 2 above it.")
    return low, high


@dataclass
class Microbe:
    number: int
    values: tuple  # attribute1, attribute2, attribute3
    traits: frozenset


def valid_trios(microbes, intervals, desired, undesired):
    eligible = [m for m in microbes if undesired not in m.traits]
    for trio in combinations(eligible, 3):
        if not any(desired in m.traits for m in trio):
            continue
        totals = tuple(map(sum, zip(*(m.values for m in trio))))
        # Checking sums avoids rounding an average across an interval boundary.
        if all(3 * low <= total <= 3 * high
               for total, (low, high) in zip(totals, intervals)):
            yield trio, totals


def ranked_trios(microbes, intervals, desired, undesired):
    """Rank allowed trios by five equally weighted, exact pass/fail checks.

    The undesired trait is a hard exclusion before enumeration. Its absence
    still earns one of the five checks. Equal scores retain microbe-ID order.
    """
    eligible = sorted((m for m in microbes if undesired not in m.traits),
                      key=lambda m: m.number)
    ranked = []
    for trio in combinations(eligible, 3):
        totals = tuple(map(sum, zip(*(m.values for m in trio))))
        checks = {attr: 3 * low <= total <= 3 * high
                  for attr, total, (low, high) in zip(ATTRIBUTES, totals, intervals)}
        checks["desired"] = any(desired in m.traits for m in trio)
        checks["excluded"] = True
        ranked.append((trio, totals, checks, 20 * sum(checks.values())))
    return sorted(ranked, key=lambda row: -row[3])


def main():
    categories = read_value("Trait names (separate with commas): ",
                            lambda text: validate_trait_names(text.split(",")))
    category_parser = lambda text: parse_category(text, categories)
    print("Ocean site | Enter each interval as two endpoints, e.g. 8,10.")
    intervals = [read_value(f"  {label} interval: ", parse_interval)
                 for label in ATTRIBUTE_LABELS]
    print("Characteristics | " + "  ".join(f"{i} = {name}"
                                           for i, name in enumerate(categories, 1)))
    desired = read_value("Desired characteristic: ", category_parser)
    undesired = read_value("Undesired characteristic: ", category_parser)
    while undesired == desired:
        print("A desired characteristic cannot also be forbidden. Re-enter the pair.")
        desired = read_value("Desired characteristic: ", category_parser)
        undesired = read_value("Undesired characteristic: ", category_parser)

    print("\nEnter each microbe's values in order: Attribute 1, Attribute 2, Attribute 3.")
    print("For characteristics, use names or menu numbers. Separate multiple traits with commas.")
    microbes = []
    for number in range(1, 11):
        values = read_value(f"Microbe {number} | Attribute 1, Attribute 2, Attribute 3: ",
                            lambda text: parse_numbers(text, 3))
        traits = read_value(f"Microbe {number} | characteristic(s): ",
                            lambda text: parse_traits(text, categories))
        microbes.append(Microbe(number, values, traits))

    matches = list(valid_trios(microbes, intervals, desired, undesired))
    if not matches:
        print("\nNo valid trio satisfies all the ocean site's rules.")
        return

    # Combinations follow input order, so the first match breaks ties by microbe ID.
    trio, totals = matches[0]
    print("\nSelected trio: " + ", ".join(f"Microbe {m.number}" for m in trio))
    carriers = [str(m.number) for m in trio if desired in m.traits]
    print(f"{desired} present in microbe(s): {', '.join(carriers)}")
    print(f"{undesired} absent from all three.")
    for i, (attr, total, (low, high)) in enumerate(zip(ATTRIBUTE_LABELS, totals, intervals)):
        terms = " + ".join(str(m.values[i]) for m in trio)
        print(f"  {attr.title()}: ({terms}) / 3 = {Fraction(total, 3)}  [{low}, {high}]")
    if len(matches) > 1:
        print(f"{len(matches)} trios satisfy every rule. Showing the first by microbe number.")


if __name__ == "__main__":
    try:
        main()
    except (EOFError, KeyboardInterrupt):
        raise SystemExit("\nInput stopped before selection.")



