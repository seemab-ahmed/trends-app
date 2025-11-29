# Trend – Definitive Scoring Rules (Initial Phase)

## Current Scoring System

| Interval        | Correct (first half) | Correct (second half) | Wrong (penalty) |
|-----------------|---------------------|----------------------|-----------------|
| Short (1 week)  | +10                 | +3                   | -2              |
| Medium (1 month)| +15                 | +5                   | -4              |
| Long (3 months) | +20                 | +7                   | -6              |

## Key Rules

### Correct Predictions
- **Time-based scoring**: Points vary based on when the prediction is made
  - **First half of period**: Higher points (10, 15, or 20)
  - **Second half of period**: Lower points (3, 5, or 7)
- Encourages early predictions when uncertainty is higher

### Incorrect Predictions
- **Fixed penalty**: Same negative points regardless of timing
  - Short: -2 points
  - Medium: -4 points
  - Long: -6 points
- Penalty is independent of when the prediction was made

## Examples

### Example 1: Short Duration (1 week)
- Predict on Monday (first half): Correct = +10, Wrong = -2
- Predict on Friday (second half): Correct = +3, Wrong = -2

### Example 2: Medium Duration (1 month)
- Predict on the 5th (first half): Correct = +15, Wrong = -4
- Predict on the 20th (second half): Correct = +5, Wrong = -4

### Example 3: Long Duration (3 months)
- Predict in month 1 (first half): Correct = +20, Wrong = -6
- Predict in month 2.5 (second half): Correct = +7, Wrong = -6

## Implementation Details

### Period Definitions
- **Short (1 week)**: Monday → Sunday
- **Medium (1 month)**: 1st → last day of month
- **Long (3 months)**: Calendar quarter (Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec)

### First Half vs Second Half
The period is split in half by time:
- First half: From period start to 50% of total duration
- Second half: From 50% of total duration to period end

### Timezone
All calculations use CEST (Europe/Berlin timezone)

