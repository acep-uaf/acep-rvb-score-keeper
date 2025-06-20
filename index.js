// acep-rvb-score-keeper
// The ACEP Red vs Blue team score keeper use the NextCloud Deck Plugin API to track score for cards completed.
// https://github.com/acep-uaf/acep-rvb-score-keeper
// index.js

import fs, { cp } from 'fs';
import path from 'path';
import { load_config, logger } from './libs/arsk-lib.js';
import https from 'https';
import fetch from 'node-fetch';
import mqtt from 'mqtt';
import { log } from 'console';

let config = load_config();

// console.log(JSON.stringify(config, null, 2));

logger("################################################################################")
logger(`Starting ACEP Red vs Blue Score Keeper`, true);
logger(`For: ${config.NAME}`, true);
logger(`  Description: ${config.DESCRIPTION}`, true);

// Log Config without config.SECRETS but without deleting it.
let logconf = { ...config };
delete logconf.SECRETS;
logger(`Config: ${JSON.stringify(logconf, null, 2)}`);
logger("===============================================================================")

// try {
//     const logconf = config
//     delete logconf.SECRETS;
//     logger(`Config: ${JSON.stringify(logconf, null, 2)}`);
// } catch (err) {
//     console.error(err);
// }



// Query Decks for each team

let metadata = {};
let stacks = {};

for (let t in config.TEAM_DECKS) {
    metadata[t] = {};
    stacks[t] = {};


    let username = config.SECRETS[config.DECK[t].SEARCH_REPLACE.NC_SERVER].USERNAME;
    let password = config.SECRETS[config.DECK[t].SEARCH_REPLACE.NC_SERVER].PASSWORD;

    // Query METADATA
    let url = config.DECK[t].QUERIES.METADATA;

    // Build fetch options
    let fetchOptions = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
        }
    };

    // Conditionally ignore SSL validation
    if (config.DECK[t].SEARCH_REPLACE.HTPROTOCOL === 'https' && config.IGNORE_SSL_VALIDATION) {
        fetchOptions.agent = new https.Agent({
            rejectUnauthorized: false
        });
    }

    // Perform the request
    logger(`Fetching ${url}`);
    let response = await fetch(url, fetchOptions);

    if (response.ok) {
        metadata[t] = await response.json();
    } else {
        logger(`Error: ${response.status} ${response.statusText}`, true);
    }

    // logger(`Metadata: ${JSON.stringify(metadata, null, 2)}`);

    // Query STACKS
    url = config.DECK[t].QUERIES.STACKS;

    // Build fetch options
    fetchOptions = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
        }
    }

    // Conditionally ignore SSL validation
    if (config.DECK[t].SEARCH_REPLACE.HTPROTOCOL === 'https' && config.IGNORE_SSL_VALIDATION) {
        fetchOptions.agent = new https.Agent({
            rejectUnauthorized: false
        });
    }

    // Perform the request
    logger(`Fetching ${url}`);
    response = await fetch(url, fetchOptions);

    if (response.ok) {
        stacks[t] = await response.json();
    } else {
        logger(`Error: ${response.status} ${response.statusText}`, true);
    }

    // logger(`Stacks: ${JSON.stringify(stacks, null, 2)}`);
}

// Aggregate Metadata and Stacks for Scoring

let competition = {};

competition.NAME = config.NAME;
competition.TITLE = metadata.title;
competition.DESCRIPTION = config.DESCRIPTION;
// competition.COLOR = '#000000'
competition.START = config.START_TS;
competition.END = config.END_TS;
competition.STATUS = "";
// competition.ENABLED = config.ENABLED;
competition.ARCHIVED = false;
// competition.TOTAL_POINTS = 0;
// competition.ASSIGNED_POINTS = 0;
// competition.AWARDED_POINTS = 0;
competition.POINTS = {};
competition.POINTSMAP = {};
competition.STACKSLIST = [];
competition.AWARDSTACK = '';
competition.LABELS = {};
competition.PEOPLE = {};
competition.ROLES = {};
competition.MODERATORS = [];
competition.TEAMS = {};
competition.SCORES = {}
competition.SCORES.TOTALS = {}
competition.SCORES.TOTALS.SUMMARY = {}
competition.SCORES.TOTALS.BYTYPE = {}
competition.SCORES.TEAMS = {}
competition.SCORES.TEAMS.SUMMARY = {}
competition.SCORES.TEAMS.BYTYPE = {}
competition.SCORES.PLAYERS = {}
competition.SCORES.PLAYERS.SUMMARY = {}
competition.SCORES.PLAYERS.BYTYPE = {}


for (let t in config.TEAM_DECKS) {
    competition.TEAMS[t] =  {}
    competition.TEAMS[t].NAME = config.TEAMS[t].NAME,
    competition.TEAMS[t].PLAYERS = [],
    competition.TEAMS[t].BOARD = config.TEAM_DECKS[t]
}



// If the competition has not started, set the status to "PENDING"
// If the competition has ended, set the status to "COMPLETED"
// if the competition is in progress, set the status to "ACTIVE"
// START_TS and END_TS use format:  2025-05-27T00:00:00.000Z

let now = new Date().toISOString();

if (now < config.START_TS) {
    competition.STATUS = "PENDING";
} else if (now > config.END_TS) {
    competition.STATUS = "COMPLETED";
} else {
    competition.STATUS = "ACTIVE";
}


for (let t in metadata) {
    competition.TEAMS[t].COLOR = metadata[t].color;
    competition.TEAMS[t].ARCHIVED = metadata[t].archived;
    competition.TEAMS[t].PERMISSIONS = {};

    // Points and Labels
    for (let l in metadata[t].labels) {
        let label = metadata[t].labels[l].title.match(/^([0-9])+ pt$/)
        if (label) {
            let points = label[1]
            competition.POINTS[points] = {}
            competition.POINTS[points]['title'] =  metadata[t].labels[l].title
            competition.POINTS[points]['points'] = points
            competition.POINTS[points]['color'] = metadata[t].labels[l].color
            competition.POINTSMAP[metadata[t].labels[l].title] = points
        } else {
            competition.LABELS[metadata[t].labels[l].title] = {}
            competition.LABELS[metadata[t].labels[l].title]['title'] =  metadata[t].labels[l].title
            competition.LABELS[metadata[t].labels[l].title]['color'] = metadata[t].labels[l].color
        }
    }    

    // Detect the 

    // Permissions
    for (let p in metadata[t].permissions) {
        // e.g. p = 'PERMISSION_READ' convert to ACL format 'permissionRead'
        let permparts = p.split('_')
        let permission = permparts[0].toLocaleLowerCase() + permparts[1].charAt(0).toUpperCase() + permparts[1].slice(1).toLocaleLowerCase();
        competition.TEAMS[t].PERMISSIONS[permission] = []
    }
    for (let p in metadata[t].acl) {
        let userpkey = metadata[t].acl[p].participant.primaryKey

        for (let k in metadata[t].acl[p]) {
            if (k.match(RegExp('^permission')) && metadata[t].acl[p][k] == true) {
                competition.TEAMS[t].PERMISSIONS[k].push(userpkey)
            }
        }
    }

    // People
    for (let u in metadata[t].users) {
        competition.PEOPLE[metadata[t].users[u].primaryKey] = {}
        competition.PEOPLE[metadata[t].users[u].primaryKey]['NAME'] = metadata[t].users[u].displayname

        if (metadata[t].owner.primaryKey == metadata[t].users[u].primaryKey && ! competition.MODERATORS.includes(metadata[t].users[u].primaryKey) ) {
            competition.MODERATORS.push(metadata[t].users[u].primaryKey)
        } else if (competition.TEAMS[t].PERMISSIONS['permissionManage'].includes(metadata[t].users[u].primaryKey) || competition.TEAMS[t].PERMISSIONS['permissionShare'].includes(metadata[t].users[u].primaryKey)) {
            if (! competition.MODERATORS.includes(metadata[t].users[u].primaryKey)) {
                competition.MODERATORS.push(metadata[t].users[u].primaryKey)
            }
        } else { // Player
            if (! competition.MODERATORS.includes(metadata[t].users[u].primaryKey)) {
                competition.TEAMS[t].PLAYERS.push(metadata[t].users[u].primaryKey)                
            }
        }
    }
}

for (let t in stacks) {
    for (let s in stacks[t]) {
        if (! competition.STACKSLIST.includes(stacks[t][s].title)) {
            competition.STACKSLIST.push(stacks[t][s].title)
        }
    }
}

// Set last STACKLIST to AWARD STACK
if (competition.STACKSLIST.length > 0) {
    competition.AWARDSTACK = competition.STACKSLIST[competition.STACKSLIST.length - 1]
}

// Score Keeping
for (let t in stacks) { // Teams
    let team = t
    // competition.SCORES.TEAMS[team] = {}

    for (let s in stacks[team]) { // Stacks
        let stack = stacks[team][s].title

        // Summary
        if (! competition.SCORES.TOTALS.SUMMARY.hasOwnProperty(stack)) {
            competition.SCORES.TOTALS.SUMMARY[stack] = 0
        }

        // Initialize By Type
        for (let tp in competition.LABELS) {
            if (! competition.SCORES.TOTALS.BYTYPE.hasOwnProperty(tp)) {
                competition.SCORES.TOTALS.BYTYPE[tp] = 0
            }
        }

        // By Team
        if (! competition.SCORES.TEAMS.SUMMARY.hasOwnProperty(stack)) {
            competition.SCORES.TEAMS.SUMMARY[ stack ] = {}
        }
        competition.SCORES.TEAMS.SUMMARY[ stack ][team] = 0

        // Initialize By Type
        for (let tp in competition.LABELS) {
            if (! competition.SCORES.TEAMS.BYTYPE.hasOwnProperty(tp)) {
                competition.SCORES.TEAMS.BYTYPE[tp] = {}
            }
            if (! competition.SCORES.TEAMS.BYTYPE[tp].hasOwnProperty(team)) {
                competition.SCORES.TEAMS.BYTYPE[tp][team] = 0
            }

            // // By Player
            // if (! competition.SCORES.PLAYERS.BYTYPE.hasOwnProperty(tp)) {
            //     competition.SCORES.PLAYERS.BYTYPE[tp] = {}

            //     for (let p in competition.TEAMS[team].PLAYERS) {
            //         competition.SCORES.PLAYERS.BYTYPE[tp][competition.TEAMS[team].PLAYERS[p]] = 0
            //     }
            // }
        }

        // By Player
        if (! competition.SCORES.PLAYERS.SUMMARY.hasOwnProperty(stack)) {
            competition.SCORES.PLAYERS.SUMMARY[stack] = {}
        }
        for (let p in competition.TEAMS[team].PLAYERS) {
            competition.SCORES.PLAYERS.SUMMARY[stack][competition.TEAMS[team].PLAYERS[p]] = 0     
        }

        for (let tp in competition.LABELS) {
            if (! competition.SCORES.PLAYERS.BYTYPE.hasOwnProperty(tp)) {
                competition.SCORES.PLAYERS.BYTYPE[tp] = {}
            }

            for (let p in competition.TEAMS[team].PLAYERS) {
                competition.SCORES.PLAYERS.BYTYPE[tp][competition.TEAMS[team].PLAYERS[p]] = 0
            }
        }

        for (let c in stacks[team][s].cards) { // Cards
            for (let l in stacks[team][s].cards[c].labels) { // Labels
                let label = stacks[team][s].cards[c].labels[l]['title']
                // logger(`DEBUG: TEAM: ${t}, STACK: ${s}, CARD: ${c}, LABEL: ${label}`)
                if (competition.POINTSMAP.hasOwnProperty(label)) {
                    // Summary
                    competition.SCORES.TOTALS.SUMMARY[stack] += Number(competition.POINTSMAP[label])


                    // By Team
                    competition.SCORES.TEAMS.SUMMARY[stack][team] += Number(competition.POINTSMAP[label])

                    // By Players
                    for (let a in stacks[team][s].cards[c].assignedUsers) {
                        let player = stacks[team][s].cards[c].assignedUsers[a].participant.primaryKey
                        competition.SCORES.PLAYERS.SUMMARY[stack][player] += Number(competition.POINTSMAP[label])
                    }

                    // By Type
                    if (stack == competition.AWARDSTACK) {
                        for (let ll in stacks[team][s].cards[c].labels) {
                            let type = stacks[team][s].cards[c].labels[ll]['title']
                            if (!competition.POINTSMAP.hasOwnProperty(type)) {
                                // Summary
                                competition.SCORES.TOTALS.BYTYPE[type] += Number(competition.POINTSMAP[label])        
    
                                // By Team
                                competition.SCORES.TEAMS.BYTYPE[type][team] += Number(competition.POINTSMAP[label])
    
                                // By Players
                                for (let a in stacks[team][s].cards[c].assignedUsers) {
                                    let player = stacks[team][s].cards[c].assignedUsers[a].participant.primaryKey
                                    competition.SCORES.PLAYERS.BYTYPE[type][player] += Number(competition.POINTSMAP[label])
                                }

                            }
                        }                            
                    }
                }
            }
        }
    }
}



// logger(`Metadata: ${JSON.stringify(metadata, null, 2)}`)
// logger(`Stacks: ${JSON.stringify(stacks, null, 2)}`)
// logger(`Competition: ${JSON.stringify(competition, null, 2)}`);


// printPointsTable(competition.stacks);

// Write to file
try {
    fs.writeFileSync(path.join(config.DIRS.DATA,`${config.NAME}.json`), JSON.stringify(competition, null, 2));
    logger(`WROTE: ${path.join(config.DIRS.DATA,`${config.NAME}.json`)}`);
} catch (err) {
    logger(`Error: ${err}`, true);
}


// Publish to MQTT Broker
// Construct MQTT URL
const mqttUrl = `mqtt://${config.MQTT.HOST}:${config.MQTT.PORT}`;
const topic = `${config.MQTT.TOPIC}`;

// Initialize MQTT client
const mqttClient = mqtt.connect(mqttUrl, {
  clientId: `pub-${config.NAME}-${Math.random().toString(16).substr(2, 8)}`,
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 1000
});


mqttClient.on('connect', () => {
    logger(`Connected to MQTT at ${mqttUrl}`, false);
  
    mqttClient.publish(topic, JSON.stringify(competition, null, 2), { qos: 1, retain: true }, (err) => {
      if (err) {
        logger(`MQTT publish error: ${err.message}`, true);
      } else {
        logger(`MQTT message published to ${topic}`, false);
      }
  
      mqttClient.end(); // Optional: Close if this is a one-shot publisher
    });
  });
  
  mqttClient.on('error', (err) => {
    logger(`MQTT client error: ${err.message}`, true);
  });


// ##########################################################
function printPointsTable(comp) {
    // Get list of all usernames from any stack
    let users = Object.keys(Object.values(comp)[0].points_assigned);

    // Header
    let header = ['Stack', 'Total Points', ...users];
    let rows = [];

    for (let stackName in comp) {
        let stack = comp[stackName];
        let row = [
            stack.title.padEnd(10),
            String(stack.points_total).padStart(12)
        ];

        for (let user of users) {
            row.push(String(stack.points_assigned[user]).padStart(10));
        }

        rows.push(row);
    }

    // Print
    console.log(header.map(h => h.padStart(10)).join(' | '));
    console.log('-'.repeat(header.length * 13));

    for (let row of rows) {
        console.log(row.join(' | '));
    }
}
