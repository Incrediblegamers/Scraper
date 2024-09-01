const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

// Function to get public proxies from multiple sources
async function getProxies() {
    const proxies = new Set();
    const sources = [
        'https://www.sslproxies.org/',
        'https://free-proxy-list.net/',
        'https://www.us-proxy.org/',
        'https://www.socks-proxy.net/',
        'https://www.proxy-list.download/HTTP'
    ];

    for (const source of sources) {
        try {
            const response = await axios.get(source);
            const $ = cheerio.load(response.data);

            $('tr').slice(0, 10).each((i, row) => {
                const tds = $(row).find('td');
                if (tds.length > 0) {
                    const proxy = `${$(tds[0]).text()}:${$(tds[1]).text()}`;
                    proxies.add(proxy);
                }
            });
        } catch (error) {
            console.log(`Error retrieving proxies from ${source}: ${error.message}`);
        }
    }

    return Array.from(proxies);
}

// Function to check if a proxy is working
async function checkProxy(proxy) {
    const url = 'https://www.google.com';
    try {
        const response = await axios.get(url, {
            proxy: {
                host: proxy.split(':')[0],
                port: proxy.split(':')[1]
            },
            timeout: 5000
        });
        return response.status === 200;
    } catch {
        return false;
    }
}

// Function to scrape Google search results
async function searchGoogle(keyword, proxy) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
    };
    const query = keyword.split(' ').join('+');
    const url = `https://www.google.com/search?q=${query}`;

    try {
        const response = await axios.get(url, {
            headers,
            proxy: {
                host: proxy.split(':')[0],
                port: proxy.split(':')[1]
            },
            timeout: 10000
        });

        if (response.status === 200) {
            const $ = cheerio.load(response.data);
            const searchResults = [];

            $('.tF2Cxc a').each((i, elem) => {
                searchResults.push($(elem).attr('href'));
            });

            for (const result of searchResults) {
                await scrapeUrlContent(result);
            }
        } else {
            console.log(`Failed to retrieve search results. Status code: ${response.status}`);
        }
    } catch (error) {
        console.log(`Error during search: ${error.message}`);
    }
}

// Function to scrape URLs for H1, title, and keywords
async function scrapeUrlContent(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        // Extract title, H1 tags, and meta keywords
        const title = $('title').text().trim() || 'No Title';
        const h1Tags = $('h1').map((i, h1) => $(h1).text().trim()).get();
        const metaKeywords = $('meta[name="keywords"]').attr('content')?.trim() || 'No Keywords';

        const output = [];

        if (title.split(' ').length <= 4) {
            output.push(`Title: ${title}`);
        }

        h1Tags.forEach(h1 => {
            if (h1.split(' ').length <= 4) {
                output.push(`H1: ${h1}`);
            }
        });

        if (metaKeywords.split(',').length <= 4) {
            output.push(`Keywords: ${metaKeywords}`);
        }

        fs.appendFileSync('scrapecontent.txt', output.join('\n') + '\n\n');
    } catch (error) {
        console.log(`Error scraping ${url}: ${error.message}`);
    }
}

// Main function
async function main() {
    // Check if keywords.txt exists, if not create it and prompt the user to add keywords
    if (!fs.existsSync('keywords.txt')) {
        console.log("keywords.txt not found. Creating the file...");
        fs.writeFileSync('keywords.txt', '');
        console.log("Please open 'keywords.txt' and add keywords (one per line).");
        return;
    }

    const proxies = await getProxies();

    if (proxies.length > 0) {
        const proxy = proxies[Math.floor(Math.random() * proxies.length)];
        const isProxyWorking = await checkProxy(proxy);

        if (isProxyWorking) {
            console.log(`Using proxy: ${proxy}`);
            const keywords = fs.readFileSync('keywords.txt', 'utf8').split('\n').map(k => k.trim()).filter(k => k);

            for (const keyword of keywords) {
                if (keyword) {
                    await searchGoogle(keyword, proxy);
                }
            }
        } else {
            console.log('No working proxies found.');
        }
    } else {
        console.log('No proxies available.');
    }
}

main();
