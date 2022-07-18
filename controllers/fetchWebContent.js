const puppeteer = require('puppeteer');

module.exports = async (req, res, next) => {
    try {
        const browser = await puppeteer.launch({});

        // 打开新页面
        const page = await browser.newPage();
        const requestUrl = req.body.src
        const isText = req.body.isText

        // 访问
        await page.goto(requestUrl, {waitUntil: 'domcontentloaded'}).catch(err => console.log(err));

        const content = isText ? await page.$eval('body', el => el.innerText) : await page.content()

        await browser.close();

        res.json({
            content
        })
    } catch (e) {
        res.json({
            content: '加载失败'
        })
    }
}
