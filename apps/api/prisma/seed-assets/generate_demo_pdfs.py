#!/usr/bin/env python3
"""Generate the lightweight Greek PDF fixtures uploaded by the Prisma seed."""

from __future__ import annotations

import argparse
import math
import textwrap
from dataclasses import dataclass, field
from pathlib import Path

import cairo


PAGE_WIDTH = 595.0
PAGE_HEIGHT = 842.0
MARGIN = 52.0
NAVY = (0.055, 0.118, 0.196)
TEAL = (0.055, 0.596, 0.616)
INK = (0.12, 0.16, 0.22)
MUTED = (0.38, 0.43, 0.5)
PAPER = (0.965, 0.976, 0.982)
WHITE = (1.0, 1.0, 1.0)
FONT_REGULAR = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"


@dataclass(frozen=True)
class DemoDocument:
    course_key: str
    doc_key: str
    course_code: str
    course_title: str
    title: str
    description: str
    page_count: int
    topics: tuple[str, ...]
    highlights: dict[int, str] = field(default_factory=dict)

    @property
    def asset_name(self) -> str:
        return f"{self.course_key}-{self.doc_key}.pdf"


DOCUMENTS = (
    DemoDocument(
        "alg201",
        "week1",
        "CS-ALG-201",
        "Αλγόριθμοι και Πολυπλοκότητα",
        "Εβδομάδα 1 - Ασυμπτωτική Ανάλυση και Ορθότητα Αλγορίθμων",
        "Εισαγωγή στους συμβολισμούς Big-O, Ω και Θ και στη λογική ορθότητας.",
        16,
        (
            "Ρυθμός αύξησης και μέγεθος εισόδου",
            "Άνω, κάτω και αυστηρό ασυμπτωτικό όριο",
            "Βρόχοι, αθροίσματα και υπολογισμός κόστους",
            "Προϋποθέσεις, μετασυνθήκες και αναλλοίωτες ιδιότητες",
        ),
        {4: "ασυμπτωτικό άνω φράγμα", 9: "αναλλοίωτη βρόχου"},
    ),
    DemoDocument(
        "alg201",
        "proof-worksheet",
        "CS-ALG-201",
        "Αλγόριθμοι και Πολυπλοκότητα",
        "Φύλλο Εργασίας Τεχνικών Απόδειξης",
        "Καθοδηγούμενες ασκήσεις σε επαγωγή και επιχειρήματα ανταλλαγής.",
        16,
        (
            "Διατύπωση βάσης και επαγωγικής υπόθεσης",
            "Σύνδεση της περίπτωσης n με την περίπτωση n+1",
            "Ισχυρή επαγωγή σε αναδρομικές δομές",
            "Επιχείρημα ανταλλαγής για άπληστους αλγορίθμους",
        ),
        {5: "επαγωγικό βήμα", 7: "ισχυρή επαγωγή"},
    ),
    DemoDocument(
        "alg201",
        "week3",
        "CS-ALG-201",
        "Αλγόριθμοι και Πολυπλοκότητα",
        "Εβδομάδα 3 - Άπληστοι Αλγόριθμοι και Επιχειρήματα Ανταλλαγής",
        "Τοπικές επιλογές, απόδειξη βελτιστότητας και τα όριά τους.",
        18,
        (
            "Κανόνας άπληστης επιλογής και σειρά επεξεργασίας",
            "Χρονοπρογραμματισμός δραστηριοτήτων και κώδικες Huffman",
            "Απόδειξη βελτιστότητας με επιχείρημα ανταλλαγής",
            "Περιπτώσεις όπου η άπληστη στρατηγική αποτυγχάνει",
        ),
        {6: "επιχείρημα ανταλλαγής", 11: "τοπικά βέλτιστη επιλογή"},
    ),
    DemoDocument(
        "alg201",
        "week5",
        "CS-ALG-201",
        "Αλγόριθμοι και Πολυπλοκότητα",
        "Εβδομάδα 5 - Διαίρει και Βασίλευε: Ταξινόμηση και Αναδρομή",
        "Αποσύνθεση προβλημάτων, συγχώνευση λύσεων και αναδρομικές σχέσεις.",
        20,
        (
            "Μοτίβο διαίρεσης, επίλυσης και συνδυασμού",
            "Merge sort και ανάλυση επιπέδων αναδρομής",
            "Quick sort, επιλογή pivot και μέση πολυπλοκότητα",
            "Master theorem και έλεγχος των προϋποθέσεών του",
        ),
        {7: "κύριο θεώρημα", 12: "δέντρο αναδρομής"},
    ),
    DemoDocument(
        "alg201",
        "week8",
        "CS-ALG-201",
        "Αλγόριθμοι και Πολυπλοκότητα",
        "Εβδομάδα 8 - Δυναμικός Προγραμματισμός και Απομνημόνευση",
        "Από την αναδρομή με επαναλήψεις στη συστηματική επαναχρησιμοποίηση λύσεων.",
        22,
        (
            "Αναγνώριση επαναλαμβανόμενων υποπροβλημάτων",
            "Απομνημόνευση από πάνω προς τα κάτω και πίνακας από κάτω προς τα πάνω",
            "Σακίδιο, μεγαλύτερη κοινή υπακολουθία και απόσταση επεξεργασίας",
            "Κόστος χώρου, ανακατασκευή λύσης και όρια της μεθόδου",
        ),
        {6: "επικαλυπτόμενα υποπροβλήματα", 14: "βέλτιστη υποδομή"},
    ),
    DemoDocument(
        "alg201",
        "week10",
        "CS-ALG-201",
        "Αλγόριθμοι και Πολυπλοκότητα",
        "Εβδομάδα 10 - Αλγόριθμοι Γράφων: Διάσχιση και Συντομότερες Διαδρομές",
        "Αναπαράσταση γράφων, διάσχιση κατά πλάτος και βάθος, συντομότερες διαδρομές.",
        19,
        (
            "Λίστες και πίνακες γειτνίασης",
            "BFS, DFS και δέντρα διάσχισης",
            "Dijkstra, χαλάρωση ακμών και ουρά προτεραιότητας",
            "Bellman-Ford, αρνητικά βάρη και ανίχνευση κύκλων",
        ),
        {7: "χαλάρωση ακμής", 13: "ουρά προτεραιότητας"},
    ),
    DemoDocument(
        "alg201",
        "week12",
        "CS-ALG-201",
        "Αλγόριθμοι και Πολυπλοκότητα",
        "Εβδομάδα 12 - NP-Πληρότητα και Πολυωνυμικές Αναγωγές",
        "Κλάσεις πολυπλοκότητας, αναγωγές και πρακτική αντιμετώπιση δύσκολων προβλημάτων.",
        17,
        (
            "Κλάσεις P, NP και πιστοποιητικά επαλήθευσης",
            "Πολυωνυμικές αναγωγές και NP-δυσκολία",
            "SAT, κάλυψη κορυφών και ανεξάρτητο σύνολο",
            "Προσεγγιστικοί και ευρετικοί αλγόριθμοι",
        ),
        {4: "πολυωνυμική αναγωγή"},
    ),
    DemoDocument(
        "alg201",
        "ta-notes",
        "CS-ALG-201",
        "Αλγόριθμοι και Πολυπλοκότητα",
        "Σημειώσεις Βοηθού Διδασκαλίας - Συνήθη Λάθη σε Αποδείξεις",
        "Ιδιωτικό βοήθημα ανατροφοδότησης για τις εργαστηριακές ασκήσεις.",
        9,
        (
            "Παράλειψη της βάσης επαγωγής",
            "Χρήση του ζητούμενου ως δεδομένου",
            "Ασυνεπής συμβολισμός μεταβλητών",
            "Έλεγχος αν η απόδειξη καλύπτει όλες τις περιπτώσεις",
        ),
    ),
    DemoDocument(
        "alg201",
        "syllabus-v1",
        "CS-ALG-201",
        "Αλγόριθμοι και Πολυπλοκότητα",
        "Περίγραμμα Μαθήματος (Παλαιά Έκδοση)",
        "Ιστορικό περίγραμμα που έχει αντικατασταθεί από τη νεότερη έκδοση του μαθήματος.",
        8,
        (
            "Αρχική κατανομή ύλης ανά εβδομάδα",
            "Παλαιός τρόπος αξιολόγησης και παραδοτέων",
            "Θέματα που μεταφέρθηκαν σε επόμενο εξάμηνο",
            "Σημείωση αντικατάστασης από το νέο περίγραμμα",
        ),
    ),
    DemoDocument(
        "alg201",
        "old-exercise-export",
        "CS-ALG-201",
        "Αλγόριθμοι και Πολυπλοκότητα",
        "Εξαγωγή Παλαιών Ασκήσεων Εξαμήνου",
        "Αρχειοθετημένο δείγμα ασκήσεων από προηγούμενη περίοδο διδασκαλίας.",
        6,
        (
            "Ασκήσεις χωρίς σύνδεση με συγκεκριμένη ενότητα",
            "Εκφωνήσεις που χρειάζονταν χειροκίνητη αντιστοίχιση",
            "Παρατηρήσεις για την έλλειψη εννοιολογικού πλαισίου",
            "Μετάβαση στο νέο φύλλο εργασίας του μαθήματος",
        ),
    ),
    DemoDocument(
        "web305",
        "week1",
        "CS-WEB-305",
        "Ανάπτυξη Διαδικτυακών Εφαρμογών",
        "Εβδομάδα 1 - Αρχιτεκτονική Client-Server και HTTP",
        "Θεμέλια της ανταλλαγής αιτημάτων και αποκρίσεων στον Ιστό.",
        14,
        (
            "Ρόλοι client, server και ενδιάμεσων συστημάτων",
            "Δομή HTTP request και response",
            "Headers, media types και caching",
            "Ανεξαρτησία αιτημάτων και διαχείριση κατάστασης",
        ),
        {2: "stateless επικοινωνία"},
    ),
    DemoDocument(
        "web305",
        "week4",
        "CS-WEB-305",
        "Ανάπτυξη Διαδικτυακών Εφαρμογών",
        "Εβδομάδα 4 - REST API Σχεδιασμός και Αυθεντικοποίηση",
        "Πόροι, μέθοδοι HTTP, κωδικοί κατάστασης και ασφαλής πρόσβαση.",
        19,
        (
            "Μοντελοποίηση πόρων και σταθερά URLs",
            "GET, POST, PUT, PATCH και DELETE",
            "Επιτυχείς αποκρίσεις και προβλέψιμα σφάλματα",
            "Sessions, cookies και έλεγχος εξουσιοδότησης",
        ),
        {5: "μερική ενημέρωση πόρου", 9: "κωδικοί κατάστασης"},
    ),
    DemoDocument(
        "db301",
        "transactions",
        "CS-DB-301",
        "Συστήματα Βάσεων Δεδομένων",
        "Παραδείγματα Απομόνωσης Συναλλαγών",
        "Λυμένα παραδείγματα για ACID, ανταγωνισμό και ανωμαλίες συναλλαγών.",
        12,
        (
            "Ατομικότητα, συνέπεια, απομόνωση και ανθεκτικότητα",
            "Dirty read, non-repeatable read και phantom read",
            "Επίπεδα απομόνωσης και συμβιβασμοί απόδοσης",
            "Σειριοποιήσιμη εκτέλεση και έλεγχος συγκρούσεων",
        ),
        {4: "φαινομενική εγγραφή", 6: "επίπεδο SERIALIZABLE"},
    ),
    DemoDocument(
        "db301",
        "indexing",
        "CS-DB-301",
        "Συστήματα Βάσεων Δεδομένων",
        "Οδηγίες Εργαστηρίου Ευρετηρίων",
        "Πρακτικά βήματα για πλάνα εκτέλεσης και επιλογή ευρετηρίου.",
        7,
        (
            "Ανάγνωση EXPLAIN και EXPLAIN ANALYZE",
            "B-tree για ισότητες, ταξινόμηση και εύρη τιμών",
            "Σειρά στηλών και επιλεκτικότητα σε σύνθετα κλειδιά",
            "Μέτρηση κόστους πριν και μετά την προσθήκη ευρετηρίου",
        ),
        {3: "σύνθετο ευρετήριο"},
    ),
    DemoDocument(
        "ml440",
        "week1",
        "CS-ML-440",
        "Μηχανική Μάθηση",
        "Εβδομάδα 1 - Επιβλεπόμενη Μάθηση και Γραμμική Παλινδρόμηση",
        "Δεδομένα εκπαίδευσης, προβλέψεις και μέτρηση σφάλματος.",
        16,
        (
            "Χαρακτηριστικά, ετικέτες και διαχωρισμός συνόλων δεδομένων",
            "Γραμμικό μοντέλο και συντελεστές",
            "Μέσο τετραγωνικό σφάλμα και ερμηνεία του",
            "Gradient descent και ρυθμός μάθησης",
        ),
        {4: "συνάρτηση κόστους MSE"},
    ),
    DemoDocument(
        "ml440",
        "week6",
        "CS-ML-440",
        "Μηχανική Μάθηση",
        "Εβδομάδα 6 - Υπερπροσαρμογή, Κανονικοποίηση και Διασταυρούμενη Επικύρωση",
        "Τεχνικές ελέγχου πολυπλοκότητας και αξιολόγησης της γενίκευσης.",
        21,
        (
            "Διαφορά εκπαίδευσης και γενίκευσης",
            "Bias, variance και συμπτώματα υπερπροσαρμογής",
            "L1 και L2 κανονικοποίηση",
            "K-fold διασταυρούμενη επικύρωση και επιλογή μοντέλου",
        ),
        {
            2: "διακύμανση μοντέλου",
            5: "όρος κανονικοποίησης",
            9: "διασταυρούμενη επικύρωση k-fold",
        },
    ),
)


def register_fonts() -> None:
    for path in (FONT_REGULAR, FONT_BOLD):
        if not Path(path).is_file():
            raise FileNotFoundError(f"Required PDF font is missing: {path}")


def set_font(context: cairo.Context, size: float, bold: bool = False) -> None:
    family = "Noto Sans"
    weight = cairo.FONT_WEIGHT_BOLD if bold else cairo.FONT_WEIGHT_NORMAL
    context.select_font_face(family, cairo.FONT_SLANT_NORMAL, weight)
    context.set_font_size(size)


def draw_wrapped(
    context: cairo.Context,
    text: str,
    x: float,
    y: float,
    width: float,
    size: float,
    color: tuple[float, float, float] = INK,
    bold: bool = False,
    line_height: float | None = None,
) -> float:
    set_font(context, size, bold)
    context.set_source_rgb(*color)
    line_height = line_height or size * 1.42
    average_character_width = max(size * 0.54, 1)
    max_characters = max(12, math.floor(width / average_character_width))
    lines = textwrap.wrap(
        text,
        width=max_characters,
        break_long_words=False,
        break_on_hyphens=False,
    ) or [""]
    for line in lines:
        context.move_to(x, y)
        context.show_text(line)
        y += line_height
    return y


def rounded_rectangle(
    context: cairo.Context,
    x: float,
    y: float,
    width: float,
    height: float,
    radius: float,
) -> None:
    context.new_sub_path()
    context.arc(x + width - radius, y + radius, radius, -math.pi / 2, 0)
    context.arc(x + width - radius, y + height - radius, radius, 0, math.pi / 2)
    context.arc(x + radius, y + height - radius, radius, math.pi / 2, math.pi)
    context.arc(x + radius, y + radius, radius, math.pi, 3 * math.pi / 2)
    context.close_path()


def draw_footer(context: cairo.Context, page_number: int, page_count: int) -> None:
    context.set_source_rgb(*MUTED)
    set_font(context, 8.5)
    context.move_to(MARGIN, PAGE_HEIGHT - 27)
    context.show_text("Academic Hub - Demo εκπαιδευτικό υλικό")
    page_label = f"Σελίδα {page_number} / {page_count}"
    context.move_to(PAGE_WIDTH - MARGIN - 78, PAGE_HEIGHT - 27)
    context.show_text(page_label)


def draw_cover(context: cairo.Context, document: DemoDocument) -> None:
    context.set_source_rgb(*NAVY)
    context.rectangle(0, 0, PAGE_WIDTH, 250)
    context.fill()

    context.set_source_rgb(*TEAL)
    context.rectangle(0, 250, PAGE_WIDTH, 8)
    context.fill()

    context.set_source_rgb(*WHITE)
    set_font(context, 12, bold=True)
    context.move_to(MARGIN, 62)
    context.show_text(document.course_code)
    draw_wrapped(context, document.course_title, MARGIN, 95, 485, 18, WHITE, True)

    y = 320.0
    y = draw_wrapped(context, document.title, MARGIN, y, 490, 25, NAVY, True, 34)
    y += 20
    y = draw_wrapped(context, document.description, MARGIN, y, 480, 12.5, INK, False, 20)

    y += 36
    rounded_rectangle(context, MARGIN, y, 490, 102, 10)
    context.set_source_rgb(*PAPER)
    context.fill()
    draw_wrapped(
        context,
        "Στόχος του υλικού",
        MARGIN + 20,
        y + 30,
        450,
        11,
        TEAL,
        True,
    )
    draw_wrapped(
        context,
        "Να λειτουργεί ως σύντομο, ρεαλιστικό δείγμα ανάγνωσης, σχολιασμού και συζήτησης μέσα στο πρωτότυπο.",
        MARGIN + 20,
        y + 56,
        445,
        11,
        INK,
    )
    draw_footer(context, 1, document.page_count)


def draw_content_page(
    context: cairo.Context,
    document: DemoDocument,
    page_number: int,
) -> None:
    context.set_source_rgb(*NAVY)
    context.rectangle(0, 0, PAGE_WIDTH, 92)
    context.fill()
    context.set_source_rgb(*WHITE)
    set_font(context, 10, bold=True)
    context.move_to(MARGIN, 34)
    context.show_text(document.course_code)
    draw_wrapped(context, document.title, MARGIN, 58, 470, 10.5, WHITE, False, 15)

    topic_index = (page_number - 2) % len(document.topics)
    topic = document.topics[topic_index]
    cycle = (page_number - 2) // len(document.topics) + 1

    y = 145.0
    context.set_source_rgb(*TEAL)
    set_font(context, 10.5, bold=True)
    context.move_to(MARGIN, y)
    context.show_text(f"ΕΝΟΤΗΤΑ {topic_index + 1}.{cycle}")
    y += 38
    y = draw_wrapped(context, topic, MARGIN, y, 490, 21, NAVY, True, 29)
    y += 22

    bullet_stems = (
        "Ορισμός: παρουσιάζουμε την έννοια με σαφή όρια και ένα μικρό παράδειγμα.",
        "Σύνδεση: εξηγούμε πώς σχετίζεται με την προηγούμενη ενότητα και με τον χάρτη ύλης.",
        "Εφαρμογή: ελέγχουμε την κατανόηση με ένα σύντομο σενάριο ή ερώτηση.",
    )
    for bullet in bullet_stems:
        context.new_path()
        context.set_source_rgb(*TEAL)
        context.arc(MARGIN + 5, y - 4, 3, 0, 2 * math.pi)
        context.fill()
        y = draw_wrapped(context, bullet, MARGIN + 20, y, 465, 11.5, INK, False, 18)
        y += 13

    callout = document.highlights.get(page_number)
    if callout:
        y = max(y + 18, 480)
        rounded_rectangle(context, MARGIN, y, 490, 118, 10)
        context.set_source_rgb(0.9, 0.972, 0.975)
        context.fill()
        draw_wrapped(context, "Σημείο σχολιασμού", MARGIN + 20, y + 28, 450, 10.5, TEAL, True)
        draw_wrapped(
            context,
            f"Το συγκεκριμένο παράδειγμα αναδεικνύει την έννοια «{callout}» και προσφέρεται για σημείωση ή απορία μέσα στον viewer.",
            MARGIN + 20,
            y + 56,
            445,
            12,
            INK,
            False,
            19,
        )
    else:
        y = max(y + 20, 520)
        rounded_rectangle(context, MARGIN, y, 490, 86, 10)
        context.set_source_rgb(*PAPER)
        context.fill()
        draw_wrapped(context, "Ερώτηση αυτοελέγχου", MARGIN + 20, y + 29, 450, 10.5, TEAL, True)
        draw_wrapped(
            context,
            "Ποιο είναι το βασικό συμπέρασμα της σελίδας και σε ποιο πραγματικό πρόβλημα θα το εφαρμόζατε;",
            MARGIN + 20,
            y + 55,
            445,
            11,
            INK,
        )

    draw_footer(context, page_number, document.page_count)


def generate_pdf(document: DemoDocument, output_dir: Path) -> Path:
    output_path = output_dir / document.asset_name
    surface = cairo.PDFSurface(str(output_path), PAGE_WIDTH, PAGE_HEIGHT)
    if hasattr(surface, "set_metadata"):
        surface.set_metadata(cairo.PDF_METADATA_TITLE, document.title)
        surface.set_metadata(cairo.PDF_METADATA_AUTHOR, "Academic Hub Demo")
        surface.set_metadata(cairo.PDF_METADATA_SUBJECT, document.course_title)

    context = cairo.Context(surface)
    draw_cover(context, document)
    context.show_page()

    for page_number in range(2, document.page_count + 1):
        draw_content_page(context, document, page_number)
        context.show_page()

    surface.finish()
    return output_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parent / "documents",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    register_fonts()

    generated = [generate_pdf(document, args.output_dir) for document in DOCUMENTS]
    print(f"Generated {len(generated)} demo PDFs in {args.output_dir}")


if __name__ == "__main__":
    main()
