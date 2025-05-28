// acep-rvb-score-keeper
// The ACEP Red vs Blue team score keeper use the NextCloud Deck Plugin API to track score for cards completed.
// https://github.com/acep-uaf/acep-rvb-score-keeper
// index.js

import { load_config, logger } from './libs/arsk-lib.js';
import https from 'https';
import fetch from 'node-fetch';

let config = load_config();

// console.log(JSON.stringify(config, null, 2));

logger(`Starting ACEP Red vs Blue Score Keeper`, true);
logger(`For: ${config.NAME}`, true);

// Log Config without config.SECRETS but without deleting it.
let logconf = { ...config };
delete logconf.SECRETS;
logger(`Config: ${JSON.stringify(logconf, null, 2)}`);

// try {
//     const logconf = config
//     delete logconf.SECRETS;
//     logger(`Config: ${JSON.stringify(logconf, null, 2)}`);
// } catch (err) {
//     console.error(err);
// }

// console.log(JSON.stringify(config, null, 2));

// Query Deck
let username = config.SECRETS[config.DECK.NC_SERVER].USERNAME;
let password = config.SECRETS[config.DECK.NC_SERVER].PASSWORD;

// Query METADATA from config.QUERIES.METADATA URL with login from config.SECRETS.[config.DECK.NC_SERVER].USERNAME and config.SECRETS.[config.DECK.NC_SERVER].PASSWORD via HTAUTH

let metadata = {};

let url = config.QUERIES.METADATA;

// Build fetch options
let fetchOptions = {
    method: 'GET',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
    }
};

// Conditionally ignore SSL validation
if (config.DECK.HTPROTOCOL === 'https' && config.IGNORE_SSL_VALIDATION) {
    fetchOptions.agent = new https.Agent({
        rejectUnauthorized: false
    });
}

// Perform the request
logger(`Fetching ${url}`);
let response = await fetch(url, fetchOptions);

if (response.ok) {
    metadata = await response.json();
} else {
    logger(`Error: ${response.status} ${response.statusText}`, true);
}

logger(`Metadata: ${JSON.stringify(metadata, null, 2)}`);


// Query STACKS

let stacks = {};

url = config.QUERIES.STACKS;

// Build fetch options
fetchOptions = {
    method: 'GET',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
    }
};

// Conditionally ignore SSL validation
if (config.DECK.HTPROTOCOL === 'https' && config.IGNORE_SSL_VALIDATION) {
    fetchOptions.agent = new https.Agent({
        rejectUnauthorized: false
    });
}

// Perform the request
logger(`Fetching ${url}`);
response = await fetch(url, fetchOptions);

if (response.ok) {
    stacks = await response.json();
} else {
    logger(`Error: ${response.status} ${response.statusText}`, true);
}

// logger(`Stacks: ${JSON.stringify(stacks, null, 2)}`);


// Aggregate Metadata and Stacks for Scoring

let competition = {};
competition.NAME = config.NAME;
competition.TITLE = metadata.title;
competition.DESCRIPTION = config.DESCRIPTION;
competition.OWNER = metadata.owner.primaryKey;
competition.TOTAL_POINTS = 0;
competition.ASSIGNED_POINTS = 0;
competition.AWARDED_POINTS = 0;

competition.scores = {}
competition.labels = {}
for (let l in metadata.labels) {
    let score = null;
    if (score = metadata.labels[l].title.match(/^([0-9])+ pt$/)) {
        competition.scores[metadata.labels[l].title] = {
            title: metadata.labels[l].title,
            points: parseInt(score[1]),
            color: metadata.labels[l].color
        }
    } else {
        competition.labels[metadata.labels[l].title] = {
            title: metadata.labels[l].title,
            color: metadata.labels[l].color
        }
    }
}

competition.permissions = metadata.permissions

competition.people = {}
competition.roles = {}
competition.roles.owner = []
competition.roles.moderators = []
competition.roles.players = []

for (let p in metadata.users) {
    competition.people[metadata.users[p].primaryKey] = {}
    competition.people[metadata.users[p].primaryKey].NAME = metadata.users[p].displayname;

    if (metadata.users[p].primaryKey == competition.OWNER) {
        competition.roles.owner.push(metadata.users[p].primaryKey);
        competition.roles.moderators.push(metadata.users[p].primaryKey);
     } else {
        competition.roles.players.push(metadata.users[p].primaryKey);
     }  
}


competition.stacks = {}
for (let s in metadata.stacks) {
    competition.stacks[metadata.stacks[s].title] = {
        id: metadata.stacks[s].id,
        title: metadata.stacks[s].title,
        points_total: 0,
        points_assigned: {}
    }

    for (let p in competition.roles.players) {
        competition.stacks[metadata.stacks[s].title].points_assigned[competition.roles.players[p]] = 0
    }
}


for (let s in stacks) {
    let stack = stacks[s].title

    for (let c in stacks[s].cards) {
        let card = stacks[s].cards[c]

        // Get Points
        for (let l in card.labels) {
            // console.log(JSON.stringify(competition.scores, null, 2))
            // console.log(`DEBUG: ${card.labels[l].title}`)

            // If card.labels[l].title is in Object.keys(competition.scores
            if (competition.scores.hasOwnProperty(card.labels[l].title)) {
                // console.log(`DEBUG MATCH: ${card.labels[l].title}`)
                competition.TOTAL_POINTS += competition.scores[card.labels[l].title].points
                competition.stacks[stack].points_total += competition.scores[card.labels[l].title].points
            }

                    // Get Card Owners
            // console.log(JSON.stringify(competition.roles.players, null, 2))
            // console.log(JSON.stringify(card.assignedUsers, null, 2))
            for (let o in card.assignedUsers) {
                // competition.roles.players is an array.
                if (competition.roles.players.includes(card.assignedUsers[o].participant.primaryKey)) {
                    competition.ASSIGNED_POINTS += competition.scores[card.labels[l].title].points
                    if (stack == "Awarded") {
                        competition.AWARDED_POINTS += competition.scores[card.labels[l].title].points
                    }
                    competition.stacks[stack].points_assigned[card.assignedUsers[o].participant.primaryKey] += competition.scores[card.labels[l].title].points
                }
            }

        }
    }
}

logger(`Competition: ${JSON.stringify(competition, null, 2)}`, true);