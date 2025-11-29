# Leaderboard Display Rules

## Overview
The leaderboard shows the top 10 users for the selected month, ranked by their Total Score with comprehensive tie-breaking rules.

## Display Rules

### Number of Users
- **Target**: Show top 10 users
- **Minimum**: No minimum - if fewer than 10 users exist, show all available
- **No single-winner filter**: Multiple users can be displayed regardless of score

### Primary Sorting: Total Score
Users are ranked by their **Total Score** (sum of all prediction points) in **descending order** (highest first).

### Tie-Breaking Rules (in order)

When multiple users have the same Total Score, the following tie-breakers are applied in sequence:

#### 1. More Correct Predictions This Month
- User with **more correct predictions** ranks higher
- This rewards accuracy, not just point accumulation

#### 2. Earlier Timestamp of Reaching the Score
- User who reached their current score **earlier** ranks higher
- Uses the earliest `evaluatedAt` timestamp among all evaluated predictions
- Rewards early participation and risk-taking

#### 3. UserId Alphabetical Order
- If still tied, sort by **userId alphabetically** (ascending)
- Ensures deterministic, stable rankings

## Examples

### Example 1: Clear Winner
```
Rank | User    | Score | Correct | Timestamp
-----|---------|-------|---------|----------
1    | Alice   | 50    | 5       | Oct 1, 10:00
2    | Bob     | 45    | 4       | Oct 1, 11:00
3    | Charlie | 40    | 4       | Oct 2, 09:00
```

### Example 2: Tie on Score, Broken by Correct Predictions
```
Rank | User    | Score | Correct | Timestamp
-----|---------|-------|---------|----------
1    | Alice   | 50    | 6       | Oct 5, 14:00  ← More correct predictions
2    | Bob     | 50    | 5       | Oct 1, 10:00
3    | Charlie | 45    | 4       | Oct 2, 09:00
```

### Example 3: Tie on Score and Correct, Broken by Timestamp
```
Rank | User    | Score | Correct | Timestamp
-----|---------|-------|---------|----------
1    | Alice   | 50    | 5       | Oct 1, 10:00  ← Earlier timestamp
2    | Bob     | 50    | 5       | Oct 5, 14:00
3    | Charlie | 45    | 4       | Oct 2, 09:00
```

### Example 4: Complete Tie, Broken by UserId
```
Rank | User       | Score | Correct | Timestamp
-----|------------|-------|---------|----------
1    | alice-123  | 50    | 5       | Oct 1, 10:00  ← Alphabetically first
2    | bob-456    | 50    | 5       | Oct 1, 10:00
3    | charlie-789| 45    | 4       | Oct 2, 09:00
```

## Implementation Details

### Current Month Leaderboard
- Calculated dynamically from all predictions made in current month
- Updates in real-time as predictions are evaluated
- Uses `evaluatedAt` timestamp for tie-breaking

### Archived Month Leaderboard
- Retrieved from `monthly_leaderboards` table
- Re-sorted with new tie-breaking rules applied
- Limited to top 10 users

### Timestamps
- Uses earliest `evaluatedAt` timestamp per user
- Represents when user first started earning their score
- Timezone: UTC (stored), Europe/Berlin (displayed)

## Benefits of This System

1. **Fair Competition**: Score is the primary metric, but accuracy matters in ties
2. **Rewards Early Participation**: Users who predict earlier get advantage in ties
3. **Predictable Rankings**: Alphabetical userId ensures stable, deterministic results
4. **No Arbitrary Cutoffs**: Shows top 10 regardless of score values
5. **Transparent Rules**: Clear, documented criteria for every ranking decision

## Changes from Previous System

### Before
- ✗ Only showed users with the highest score (single winner)
- ✗ Required minimum points to appear
- ✗ No clear tie-breaking rules
- ✗ Could show 0-1 users even with many participants

### After
- ✓ Shows top 10 users with any score
- ✓ No minimum points required
- ✓ Clear 3-tier tie-breaking system
- ✓ Always shows up to 10 users (or all if fewer)

