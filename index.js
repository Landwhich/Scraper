const puppeteer = require('puppeteer');
const fs = require('fs');

async function run() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    let totalData = ''; //final data to be mapped and sent to excel sheet
    let dataString;     //data for bed/bath/sqrft/$
    let links = [];     //array for links

    console.log('starting link scraping...\nscraping pages for https://www.zumper.com/apartments-for-rent/victoria-bc')   //CHANGE LINK LOCATION DATA HERE
    // web scrape using puppeteer 
    // get num of oages from home page
    await page.goto(`https://www.zumper.com/apartments-for-rent/victoria-bc`);                          //CHANGE LINK LOCATION DATA HERE
    const pageCount = (await page.evaluate(() => Array.from(document.querySelectorAll('p'), (p) => p.innerText)));
    let pageNum = parseInt(pageCount[13].slice(0,3));
    pageNum = (-Math.floor(-pageNum/50));
    //scrape homepage for links get links from all pages
    console.log('read pages: ');
    for (i=0;i<pageNum;i++){
        await page.goto(`https://www.zumper.com/apartments-for-rent/victoria-bc?page=${i+1}`);          //CHANGE LINK LOCATION DATA HERE
        const noLinks = await page.evaluate(() => {
            const listings = document.querySelectorAll('.css-8a605h');
            const noLinks = [];
            for (const listing of listings) {
                const anchors = listing.querySelectorAll('a');
                for (const anchor of anchors) {
                    noLinks.push(anchor.href);
                }
            }
            return noLinks;
        });
        console.log(i);
        links.push(...noLinks);
    }
    console.log('\nIndividual links scraped from home page,\n\nstarting to scrape info from pages...')
    //scrape each link for data
    for (i=0;i<links.length;i++){
        console.log(i + ' - ' + links[i] + '\t\t...working')
        try {
            await page.goto(links[i]);
            await page.waitForSelector('#floor-plans table', { timeout: 5000 });
        } catch (error) {
            console.log('\nX failed')
            continue; // move on to the next link index
        }
        //logging links names for testing and loading bar
        let title = await page.evaluate(() => document.title);
        let td = await page.evaluate(() => {
            const floorPlansTable = document.querySelector('#floor-plans table');
            return Array.from(floorPlansTable.querySelectorAll('tr'), (tr) => 
                Array.from(tr.querySelectorAll('td'), (td) => td.innerText)
            );
        });
        let amenities = await page.evaluate(() => {
            const amenitiesData = document.querySelector('#amenities');
            if (!amenitiesData) return null;
            return Array.from(amenitiesData.querySelectorAll('tr'), (tr) => 
                Array.from(tr.querySelectorAll('td'), (amenitiesData) => amenitiesData.innerText)
            );
        });
        // remove sqft + $/mo for excel calc
        for (j = 0; j < td.length; j++){
            td[j][4] = (td[j][4].replace(/,/g,'')).slice(0,4);
        }
        for (j = 0; j < td.length; j++){
            td[j][5] = (td[j][5].replace(/,/g,'')).slice(1,6);
        }
        //check for null in amenities
        if (amenities != null){
            let amenData = amenities.map((item) => (item).join(',')).join(',');
            dataString = td.map((item) => `${title+'\t'} ${(item[4] = item[4] || 'N/A', (item.slice(2,6)).join('\t'))} ${'\t'+(parseFloat(item[5])/parseFloat(item[4])).toFixed(1)+'$/sqft'} ${'\t'+amenData}`).join('\n');
        }
        else {
            dataString = td.map((item) => `${title+'\t'} ${(item[4] = item[4] || 'N/A', (item.slice(2,6)).join('\t'))} ${'\t'+(parseFloat(item[5])/parseFloat(item[4])).toFixed(1)+'$/sqft'} ${'\tN/A'}`).join('\n');
        }
        totalData += dataString + '\n';
    }
    //filewrite all data after being formatted
    console.log('\nwriting to txt file...\n')
    fs.writeFileSync('scraped_data.txt', totalData);
    console.log('all done, check system for scraped_data.txt\n');

    await browser.close();
}

run();