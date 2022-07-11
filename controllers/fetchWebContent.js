const puppeteer = require('puppeteer');

module.exports = async (req, res, next) => {
    try {
        const browser = await puppeteer.launch({});

        // 打开新页面
        const page = await browser.newPage();
        const requestUrl = req.body.src

        // 访问
        await page.goto(requestUrl, {waitUntil: 'domcontentloaded'}).catch(err => console.log(err));

        const content = await page.content()

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
