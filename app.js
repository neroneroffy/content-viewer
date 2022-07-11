const express = require('express')
const bodyParser = require('body-parser');
const path = require('path');

const webRoute = require('./routes/web')

const app = express()
const port = 8848

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(express.static(path.join(__dirname, 'public')));
//设置CORS
app.all('*',function (req, res, next) {
    res.header('Access-Control-Allow-Origin','*');
    res.header('Access-Control-Allow-Headers','content-type,Content-Length, Authorization,Origin,Accept,X-Requested-With'); //允许的请求头
    res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, PUT'); //允许的请求方法
    res.header('Access-Control-Allow-Credentials',true);  //允许携带cookies
    next();
});
app.use('/web',webRoute)

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
