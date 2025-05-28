# acep-rvb-score-keeper

The ACEP Red vs Blue team score keeper use the NextCloud Deck Plugin API to track score for cards completed.

## Architecture

Project Directory Structure
```
acep-rvb-score-keeper
├── conf
│   └── compdemo.json
├── data
│   └── example.json
├── index.js
├── LICENSE
├── package.json
├── README.md
└── secrets
    └── credentials.json
```

### Configuration

There should be a configuration file for each competion to be scored under the `conf` directory. This file should have the following format:

```json
{
    "COMPETITION_NAME": "compdemo",
    "DESCCRIPTION": "Demo Competition",
    "NC_DECK_BOARD_URL": "https://rvbshare.acep.uaf.edu/index.php/apps/deck/board/3"
}
```

### Secrets

The NextCloud Deck Plugin API requires a user login to be provided.  Credential should be stored under the `secrets` directory in the following format:

```json
{  "NC_SERVERS": {
        "rvbshare.acep.uaf.edu": {
            "USERNAME": "jehaverlack",
            "PASSWORD": "password"        
        }
    }
}
```

### Data Query Format

The data directory contains an example of the data that will be provided to the NextCloud Deck Plugin API.

```json
[
  {
    "id": 4,
    "title": "Quests",
    "boardId": 2,
    "deletedAt": 0,
    "lastModified": 1748045837,
    "cards": [
      {
        "id": 4,
        "title": "Quest 1",
        "description": "",
        "stackId": 4,
        "type": "plain",
        "lastModified": 1748045837,
        "lastEditor": "jehaverlack",
        "createdAt": 1748020975,
        "labels": [
          {
            "id": 7,
            "title": "Action needed",
            "color": "FF7A66",
            "boardId": 2,
            "cardId": 4,
            "lastModified": 0,
            "ETag": "cfcd208495d565ef66e7dff9f98764da"
          },
          {
            "id": 10,
            "title": "2 pt",
            "color": "0000FF",
            "boardId": 2,
            "cardId": 4,
            "lastModified": 1748044849,
            "ETag": "6301f0e78d8decb4b08aa8891fb259a4"
          }
        ],
        "assignedUsers": [],
        "attachments": null,
        "attachmentCount": 0,
        "owner": {
          "primaryKey": "jehaverlack",
          "uid": "jehaverlack",
          "displayname": "John Haverlack",
          "type": 0
        },
        "order": 999,
        "archived": false,
        "done": null,
        "duedate": null,
        "deletedAt": 0,
        "commentsUnread": 0,
        "commentsCount": 0,
        "ETag": "64ac8369b30ccab562c5102fef8d4d95",
        "overdue": 0,
        "referenceData": null
      }
    ],
    "order": 999,
    "ETag": "64ac8369b30ccab562c5102fef8d4d95"
  },
  {
    "id": 5,
    "title": "Assigned",
    "boardId": 2,
    "deletedAt": 0,
    "lastModified": 0,
    "order": 999,
    "ETag": "cfcd208495d565ef66e7dff9f98764da"
  },
  {
    "id": 6,
    "title": "Claimed",
    "boardId": 2,
    "deletedAt": 0,
    "lastModified": 0,
    "order": 999,
    "ETag": "cfcd208495d565ef66e7dff9f98764da"
  },
  {
    "id": 7,
    "title": "Completed",
    "boardId": 2,
    "deletedAt": 0,
    "lastModified": 0,
    "order": 999,
    "ETag": "cfcd208495d565ef66e7dff9f98764da"
  }
]
```