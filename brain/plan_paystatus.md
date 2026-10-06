# Plan: Use MongoDB `paystatus` for Balance Due

## Overview
Currently, the "Balance Due" in the Participants list is calculated by joining the local MariaDB `payments` table and aggregating the unpaid amounts manually. Since the MongoDB `Participants` view now directly includes a `paystatus` object, we can simplify this logic, improve performance, and ensure consistency by reading this object directly.

## Step 1: Database Migration
We will add three new columns to the local MariaDB `registrations` table to store this data during the sync process:
- `paystatus_total` (DECIMAL(10,2), default 0.00)
- `paystatus_paid` (DECIMAL(10,2), default 0.00)
- `paystatus_due` (DECIMAL(10,2), default 0.00)

*Alternative*: Store it as a single JSON object column, but separate decimals are cleaner for quick SQL queries (e.g., sorting by debt).

## Step 2: Update the Sync Script (`scripts/sync-all.js`)
In the "Participants" sync module of `scripts/sync-all.js`:
1. Extract the `paystatus` object from the MongoDB `record`. Default to `{ total: 0, paid: 0, due: 0 }` if missing.
2. **On Insert**: Update the `INSERT INTO registrations` query to include the three new `paystatus_*` fields.
3. **On Update**: Currently, `sync-all.js` doesn't update existing `registrations` unless their status changes. We'll add an `UPDATE registrations SET paystatus_due = ? ... WHERE id = ?` to ensure balances stay up-to-date every time the sync runs.

## Step 3: Update the Frontend / Actions
1. **Database Queries**: Update the SQL queries in `src/app/participants/page.js` (and anywhere else the participant list is fetched, e.g., QR check-ins or Social Dinner) to select `r.paystatus_due`, `r.paystatus_paid`, and `r.paystatus_total`.
2. **UI Updates**:
   - In `ParticipantRow.js` and `ParticipantsClient.js`, replace the existing manual iteration over the `payments` array with the direct `paystatus_due` value.
   - We will still display the `payments` table inside the details dropdown for transparency, but the overarching "Unpaid: €X" pill will rely entirely on `paystatus_due`.

## Important Consideration: Local Manual Payments
**Question for you before proceeding:** 
Currently, admins can add "Manual Payments" directly within this web dashboard. If an admin registers a payment here manually, it gets stored in the local MariaDB `payments` table. 
If we switch the "Balance Due" to rely *strictly* on MongoDB's `paystatus`, any manual payments made locally might not be reflected in that balance (unless they are synced *back* to MongoDB). 

**Should we:**
A) Make "Balance Due" = `MongoDB paystatus.due` **minus** `Local manual payments`?
B) Or rely *strictly* on `paystatus.due`, assuming manual payments will be handled externally or synced via another mechanism?
