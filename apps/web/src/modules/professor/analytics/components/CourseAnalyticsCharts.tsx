import type { ProfessorCourseAnalytics } from '@web-app/contracts';

// Validated categorical pair (fixed order, never cycled): slot 1 + slot 2 of
// the dataviz palette clear the CVD/normal-vision separation floors.
const SERIES_QUESTIONS = '#2a78d6';
const SERIES_ANSWERED = '#eb6834';
const SERIES_PROGRESS = '#2a78d6';

const TEXT_PRIMARY = '#10243a';
const TEXT_MUTED = '#596b7e';
const GRID_LINE = '#d9e3ea';

function niceCeiling(value: number): number {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const niceNormalized = normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

export function QuestionsAnsweredChart({
  courses,
}: {
  courses: ProfessorCourseAnalytics[];
}): React.JSX.Element {
  const width = 640;
  const height = 260;
  const marginTop = 16;
  const marginBottom = 32;
  const plotWidth = width;
  const plotHeight = height - marginTop - marginBottom;

  const maxValue = Math.max(
    1,
    ...courses.flatMap((course) => [course.questionCount, course.answeredCount]),
  );
  const niceMax = niceCeiling(maxValue);

  const groupWidth = plotWidth / courses.length;
  const barWidth = Math.min(28, groupWidth / 2 - 6);
  const barGap = 4;

  return (
    <figure className="analytics-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Απορίες και απαντημένες απορίες ανά μάθημα"
      >
        <g transform={`translate(0, ${marginTop})`}>
          {[0, 0.5, 1].map((fraction) => {
            const y = plotHeight * (1 - fraction);
            const value = Math.round(niceMax * fraction);
            return (
              <g key={fraction}>
                <line
                  x1={0}
                  x2={plotWidth}
                  y1={y}
                  y2={y}
                  stroke={GRID_LINE}
                  strokeWidth={1}
                />
                <text x={0} y={y - 4} fontSize={10} fill={TEXT_MUTED}>
                  {value}
                </text>
              </g>
            );
          })}

          {courses.map((course, index) => {
            const centerX = index * groupWidth + groupWidth / 2;
            const qHeight = (course.questionCount / niceMax) * plotHeight;
            const aHeight = (course.answeredCount / niceMax) * plotHeight;
            const qX = centerX - barWidth - barGap / 2;
            const aX = centerX + barGap / 2;

            return (
              <g key={course.courseId}>
                <rect
                  x={qX}
                  y={plotHeight - qHeight}
                  width={barWidth}
                  height={qHeight}
                  rx={4}
                  fill={SERIES_QUESTIONS}
                >
                  <title>{`${course.courseCode} · Απορίες: ${course.questionCount}`}</title>
                </rect>
                {course.questionCount > 0 && (
                  <text
                    x={qX + barWidth / 2}
                    y={plotHeight - qHeight - 6}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={700}
                    fill={TEXT_PRIMARY}
                  >
                    {course.questionCount}
                  </text>
                )}

                <rect
                  x={aX}
                  y={plotHeight - aHeight}
                  width={barWidth}
                  height={aHeight}
                  rx={4}
                  fill={SERIES_ANSWERED}
                >
                  <title>{`${course.courseCode} · Απαντημένες: ${course.answeredCount}`}</title>
                </rect>
                {course.answeredCount > 0 && (
                  <text
                    x={aX + barWidth / 2}
                    y={plotHeight - aHeight - 6}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={700}
                    fill={TEXT_PRIMARY}
                  >
                    {course.answeredCount}
                  </text>
                )}

                <text
                  x={centerX}
                  y={plotHeight + 18}
                  textAnchor="middle"
                  fontSize={11}
                  fill={TEXT_MUTED}
                >
                  {course.courseCode}
                </text>
              </g>
            );
          })}

          <line
            x1={0}
            x2={plotWidth}
            y1={plotHeight}
            y2={plotHeight}
            stroke={GRID_LINE}
            strokeWidth={1}
          />
        </g>
      </svg>
      <figcaption className="analytics-chart-legend">
        <span className="analytics-legend-item">
          <i style={{ background: SERIES_QUESTIONS }} />
          Απορίες
        </span>
        <span className="analytics-legend-item">
          <i style={{ background: SERIES_ANSWERED }} />
          Απαντημένες
        </span>
      </figcaption>
    </figure>
  );
}

export function StudentProgressChart({
  courses,
}: {
  courses: ProfessorCourseAnalytics[];
}): React.JSX.Element {
  const sorted = [...courses].sort(
    (a, b) => b.averageProgressPercentage - a.averageProgressPercentage,
  );
  const rowHeight = 24;
  const rowGap = 14;
  const marginLeft = 104;
  const marginRight = 40;
  const width = 640;
  const plotWidth = width - marginLeft - marginRight;
  const height = sorted.length * (rowHeight + rowGap) - rowGap;

  return (
    <figure className="analytics-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Μέση πρόοδος φοιτητών ανά μάθημα"
      >
        {sorted.map((course, index) => {
          const y = index * (rowHeight + rowGap);
          const barWidth = Math.max(
            (course.averageProgressPercentage / 100) * plotWidth,
            course.averageProgressPercentage > 0 ? 4 : 0,
          );

          return (
            <g key={course.courseId}>
              <text
                x={marginLeft - 12}
                y={y + rowHeight / 2 + 4}
                textAnchor="end"
                fontSize={14}
                fontWeight={700}
                fill={TEXT_PRIMARY}
              >
                {course.courseCode}
              </text>
              <rect
                x={marginLeft}
                y={y}
                width={plotWidth}
                height={rowHeight}
                rx={4}
                fill={GRID_LINE}
              />
              <rect
                x={marginLeft}
                y={y}
                width={barWidth}
                height={rowHeight}
                rx={4}
                fill={SERIES_PROGRESS}
              >
                <title>{`${course.courseCode} · Μέση πρόοδος: ${course.averageProgressPercentage}%`}</title>
              </rect>
              <text
                x={marginLeft + plotWidth + 8}
                y={y + rowHeight / 2 + 4}
                fontSize={14}
                fontWeight={700}
                fill={TEXT_PRIMARY}
              >
                {course.averageProgressPercentage}%
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
