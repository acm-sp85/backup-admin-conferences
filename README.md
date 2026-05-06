SCRIPT TO SYNC ALL DATA FROM MONGO TO MARIADB

Update the conference ACRONYM before running the sync scripts:
CONFERENCE_ACRONYM=HOPV26

// open 3 terminals
npm run tunnel
npm run tunnel-mongo
npm run sync

updated