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


    // Expand Data Directory
    let search_replace = {}
    search_replace['DIRNAME'] = __dirname
    for (let d in config.DIRS) {
        search_replace[d.toUpperCase()] = d
    }

    for (let d in config.DIRS) {
        for (let s in search_replace) {
        switch (s) {
            case 'DIRNAME':
            config.DIRS[d] = path.join(config.DIRS[d].replace(s, __dirname))
            break
            default:
            config.DIRS[d] = path.join(config.DIRS[d].replace(s, config.DIRS[search_replace[s]]))
            break
        }
        }
    }

    // Ensure Directories Exist
    for (let d in config.DIRS) {
        if (!fs.existsSync(config.DIRS[d])) {
            try {
                fs.mkdirSync(config.DIRS[d], { recursive: true });
            } catch (err) {
                console.error(err);
            }
        }
    }

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
