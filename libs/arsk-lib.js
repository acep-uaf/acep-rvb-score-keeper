import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = load_config();


function load_config() {
    let config = {};

    const argv = yargs(hideBin(process.argv))
    .usage('Usage: npm start -- <options>')
    .option('deckconf', {
        alias: 'd',
        description: 'Path to Deck config file',
        type: 'string',
        demandOption: true
    })
    .help()
    .alias('help', 'h')
    .argv;

    // Debug Argv
    // console.log(JSON.stringify(argv, null, 2));

    // Load Config
    try {
        config = JSON.parse(fs.readFileSync(argv.deckconf, 'utf8'));
        // config.DIRS.base = config.DIRS.base + '/..'
    } catch (err) {
        console.error(err);
    }

    // Load Included Configs
    for (let i in config.INCLUDES) {
        try {
            let include = JSON.parse(fs.readFileSync(path.join(path.dirname(argv.deckconf), config.INCLUDES[i]), 'utf8'));
            for (let k in include) {
                config[k] = include[k]
            }
        } catch (err) {
            console.error(err);
        }
    }

    if (!config.hasOwnProperty('TYPE')) {
        config.TYPE = 'OPEN'
    }

    switch (config.TYPE) {
        case 'OPEN':
            config.TYPE = 'OPEN'
            config = load_config_default(config);
            break
        case 'MULTI-TEAM':
            config.TYPE = 'MULTI-TEAM'
            config = load_config_multiteam(config);
            break
        default:
            console.error(`Unknown BOARD TYPE: ${config.TYPE}`);
            process.exit(1);
    }

    return config
}

function load_config_multiteam(config) {

    // Expand Directories
    config.DIRS = expand_directories(config.DIRS)

    // Team Deck API
    config.DECK = {}

    // extract NC_SERVER from config.TEAM_DECKS for each TEAM
    for (let t in config.TEAM_DECKS) {
        config.DECK[t] = {};
        config.DECK[t].SEARCH_REPLACE = {};
    
        // Extract values
        const matchServer = config.TEAM_DECKS[t].match(/https?:\/\/([^\/]+)/);
        const matchBoard = config.TEAM_DECKS[t].match(/board\/(\d+)/);
        const matchProto = config.TEAM_DECKS[t].match(/https?:/);
    
        config.DECK[t].SEARCH_REPLACE.NC_SERVER = matchServer?.[1] || "";
        config.DECK[t].SEARCH_REPLACE.BOARD_ID = matchBoard?.[1] || "";
        config.DECK[t].SEARCH_REPLACE.HTPROTOCOL = (matchProto?.[0] || "").replace(":", "");
    
        config.DECK[t].QUERIES = {};
    
        for (let q in config.QUERIES) {
            let replaced = config.QUERIES[q];
            for (let sr in config.DECK[t].SEARCH_REPLACE) {
                const re = new RegExp(sr, "g");
                replaced = replaced.replace(re, config.DECK[t].SEARCH_REPLACE[sr]);
            }
            config.DECK[t].QUERIES[q] = replaced;
        }
    }

    // Team Queries
    return config;
}




function load_config_default(config) {

    // Expand Directories
    config.DIRS = expand_directories(config.DIRS)

    // Deck API
    config.DECK = {}

    // extract NC_SERVER from NC_DECK_BOARD_URL
    // e.g.: "NC_DECK_BOARD_URL": "https://rvbshare.acep.uaf.edu/index.php/apps/deck/board/3",
    // We want rvbshare.acep.uaf.edu from a http or https URL
    config.DECK.NC_SERVER = config.NC_DECK_BOARD_URL.match(/https?:\/\/([^\/]+)/)[1]

    // extract BOARD_ID form NC_DECK_BOARD_URL
    // e.g.: "NC_DECK_BOARD_URL": "https://rvbshare.acep.uaf.edu/index.php/apps/deck/board/3",
    // We want 3 from /index.php/apps/deck/board/3
    config.DECK.BOARD_ID = config.NC_DECK_BOARD_URL.match(/board\/(\d+)/)[1]

    // extract http protocol from NC_DECK_BOARD_URL
    // e.g.: "NC_DECK_BOARD_URL": "https://rvbshare.acep.uaf.edu/index.php/apps/deck/board/3",
    // We want https from https://rvbshare.acep.uaf.edu
    config.DECK.HTPROTOCOL = config.NC_DECK_BOARD_URL.match(/https?:/)[0]   
    config.DECK.HTPROTOCOL = config.DECK.HTPROTOCOL.replace(':', '')
    let deck_search_replace = {}
    deck_search_replace['HTPROTOCOL'] = config.DECK.HTPROTOCOL
    deck_search_replace['NC_SERVER'] = config.DECK.NC_SERVER
    deck_search_replace['BOARD_ID'] = config.DECK.BOARD_ID 

    // console.log(JSON.stringify(deck_search_replace, null, 2))            

    for (let q in config.QUERIES) {
        for (let s in deck_search_replace) {
            config.QUERIES[q] = config.QUERIES[q].replace(s, deck_search_replace[s])
            // Hack: replace '::' with ':'
            // config.QUERIES[q] = config.QUERIES[q].replace('\:\:', ':')
        }
    }


    // for (let s in search_replace) {
    //     switch (s) {
    //       case 'DIRNAME':
    //         config.key = path.join(config.key.replace(s, __dirname))
    //         break
    //       case 'CONF':
    //         config.acep.directory_json = path.join(config.acep.directory_json.replace(s, config.DIRS.conf))
    //         break
    //     default:
    //         config.key = path.join(config.key.replace(s, config.DIRS[search_replace[s]]))
    //         break
    //     }
    //   }


    // // Get Host IP Addresses
    // const networkInterfaces = os.networkInterfaces();
    // config.host = {}
    // config.host.ips = [];
    // for (const interfaceName in networkInterfaces) {
    //     const addresses = networkInterfaces[interfaceName];
    //     for (const address of addresses) {
    //         if (address.family === 'IPv4' && !address.internal) {
    //             config.host.ips.push(address.address);
    //         }
    //     }
    // }

    // config.host.ips.push('127.0.0.1');

    return config;
}

function expand_directories(dirs) {
    // Expand Data Directory
    let search_replace = {}
    search_replace['DIRNAME'] = __dirname
    for (let d in dirs) {
        search_replace[d.toUpperCase()] = d
    }

    for (let d in dirs) {
        for (let s in search_replace) {
            switch (s) {
                case 'DIRNAME':
                dirs[d] = path.join(dirs[d].replace(s, __dirname))
                break
                default:
                dirs[d] = path.join(dirs[d].replace(s, dirs[search_replace[s]]))
                break
            }
        }
    }

    // Ensure Directories Exist
    for (let d in dirs) {
        if (!fs.existsSync(dirs[d])) {
            try {
                fs.mkdirSync(dirs[d], { recursive: true });
            } catch (err) {
                console.error(err);
            }
        }
    }

    return dirs
}


// Logger Function
function logger(msg, cnsl=false) {
    const now = new Date();
    const ts_datetime = now.toISOString();                         // "YYYY-MM-DDTHH:MM:SS.sssZ"
    const ts_date = ts_datetime.split('T')[0];                     // "YYYY-MM-DD"
  
    const logFile = path.join(config.DIRS.LOGS, `${config.NAME}-${ts_date}.log`);
  
    try {
      fs.appendFileSync(logFile, `${ts_datetime} : ${msg}\n`, 'utf8');
      if (cnsl) { console.log(msg); }
    } catch (err) {
      console.error(`Logger error: Could not write to ${logFile}`, err);
    }
  }

  export { load_config, logger };
