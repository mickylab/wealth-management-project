const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const data = require('../data');
const stockData = data.stocks;
const axios = require ('axios');
const xss = require ('xss');
/*
const priceOptions = { //Replace underscore in path with desired symbol
    hostname: 'financialmodelingprep.com',
    port: 443,
    path: '/api/v3/quote-short/_?apikey=4116b7eb972d010e408e5e350e723b1a',
    method: 'GET'
  }

const nameOptions = { //Replace underscore in path with desired symbol
    hostname: 'financialmodelingprep.com',
    port: 443,
    path: '/api/v3/profile/_?apikey=4116b7eb972d010e408e5e350e723b1a',
    method: 'GET'
  } */
function checkSymbol (sym){
    if (!sym){
        return 'Error: must enter symbol';
    }
    if (typeof sym != 'string'){
        return 'Error: symbol must be a string';
    }
    if (sym.trim().length === 0){
        return 'Error: symbol cannot be empty strings';
    }
    return "";
}

function checkAmount(num){
    if (!num){
        return 'Error: must provide amount';
    }
    if (isNaN(parseInt(num))){
        return 'Error: amount must be a number';
    }
    if (parseInt(num) <= 0){
        return 'Error: amount must be greater than zero';
    }
    return "";
}
function checkPrice(price){
    if (!price){
        return 'Error: must provide price'
    }
    if(isNaN(Number(price))){
        return 'Error: price must be a number';
    }
    if (price <= 0){
        return 'Error: price must be greater than zero';
    }
    return "";
}
router.post('/search', async (req, res) => {
    if (req.session.user){
        let sym = xss(req.body.stockCode);
        let symCheck = checkSymbol(sym);
        let errors = [];
        if (symCheck.length != 0){
            errors.push(symCheck);
            return res.status(400).render("stocks", {
                title: "Error",
                authenticated: true,
                errors: errors,
              });
        }
        sym = sym.trim().toUpperCase();

        return res.status(200).redirect(`/stocks/${sym}`);
    }
    else{
        return res.status(403).redirect('/login');
    }
});
router.get('/:symbol', async (req, res) =>{
    if(req.session.user){
    let sym = req.params.symbol;
    let symCheck = checkSymbol(sym);
    let errors = [];
    if (symCheck.length !== 0){
        errors.push(symCheck);
            return res.status(400).render("stocks", {
                title: "Error",
                authenticated: true,
                errors: errors,
              });
    }
    sym = sym.trim().toUpperCase();
    let findStock;
    try{
        findStock = await stockData.getStockBySymbol(sym);
    }
    catch (e){
        errors.push(e);
        return res.status(400).render("stocks", {
            title: "Error",
            authenticated: true,
            errors: errors,
          });
    }
    let result = [];
    for(let i = 0; i < findStock.stockholders.length; i++){
        if (findStock.stockholders[i].userId.toString() == req.session.user._id){
            let info = await axios.get(`https://financialmodelingprep.com/api/v3/quote/${sym}?apikey=14bf083323c7d4f37ef667f48d105a93`);
            let temp ={
                symbol: sym,
                name: info.data[0].name,
                price: info.data[0].price,
                numberOfShares: findStock.stockholders[i].numberOfStocks,
                marketValue: 0
            }
            temp.marketValue = Math.round(temp.numberOfShares * temp.price * 100) / 100;
            result.push(temp);
            break;
        }
    }
    return res.render("stocks", {stocks: result, currUser: req.session.user});
}
else{
    return res.status(403).redirect('/login');
}
});
router.get('/', async (req, res) =>{
    if (req.session.user){
        let errors = [];
        let ownedStocks;
        try{
            ownedStocks = await stockData.getAllStocksOwned(req.session.user._id);
        }
        catch(e){
            errors.push(e);
            return res.status(400).render("stocks", {
                title: "Error",
                authenticated: true,
                errors: errors,
              });
        }
        let result = [];
        for (let i = 0; i < ownedStocks.length; i++){
            let temp = {
                symbol: ownedStocks[i].symbol,
                name: "",
                price: 0,
                numberOfShares: ownedStocks[i].amount,
                marketValue: 0
            };
            let info = await axios.get(`https://financialmodelingprep.com/api/v3/quote/${ownedStocks[i].symbol}?apikey=14bf083323c7d4f37ef667f48d105a93`);
            //4116b7eb972d010e408e5e350e723b1a
            setTimeout(() => {
                console.log("sleep");
            }, 500);
            temp.price = info.data[0].price;
            temp.name = info.data[0].name;
            temp.marketValue = Math.round(temp.numberOfShares * temp.price * 100) / 100;
            result.push(temp);
        }
        return res.status(200).render("stocks",{stocks: result, currUser: req.session.user});
    }
    else{
        return res.status(403).redirect('/login');
    }
})

router.post('/tradestock', async (req, res) =>{
    if (req.session.user){
    let formData = req.body;
    let amount = xss(formData.inputQuantity);
    let price = xss(formData.inputStockPrice);
    let symbol = xss(formData.inputStockCode);
    let time = Date.now();
    let type = xss(formData.inputTradeType);
    let errors = [];
    let symCheck = checkSymbol(symbol);
    if (symCheck.length != 0){
        errors.push(symCheck);
        return res.status(400).render("trade", {
          title: "Error",
          authenticated: true,
          errors: errors,
        });
    }
    symbol = symbol.trim().toUpperCase();
    let amountCheck = checkAmount(amount);
    if(amountCheck.length != 0){
        errors.push(amountCheck);
        return res.status(400).render("trade", {
          title: "Error",
          authenticated: true,
          errors: errors,
        }); 
    }
    amount = parseInt(amount);

    let priceCheck = checkPrice(price);
    price = Number(price);   
    if (priceCheck.length != 0){
        errors.push(priceCheck);
        return res.status(400).render("trade", {
          title: "Error",
          authenticated: true,
          errors: errors,
        });
    }
    let findStockCheck;
    try{
        findStockCheck = await stockData.getStockBySymbol(symbol);
    }
    catch(e){
        errors.push(e);
        return res.status(400).render("trade", {
          title: "Error",
          authenticated: true,
          errors: errors,
        });
    }
    if (findStockCheck == null){
        try{
            findStockCheck = await stockData.createStock(symbol);
        }
        catch(e){
            errors.push(e);
            return res.status(400).render("trade", {
            title: "Error",
            authenticated: true,
            errors: errors,
            });
        }
    }
    let stockId = findStockCheck._id.toString();
    let userId = req.session.user._id;
    console.log(req.session);
    let stockTransactionCheck;
    if (type === "Buy"){
        try{
            stockTransactionCheck = await stockData.buyStock(userId, amount, stockId, time, price, symbol);
        }
        catch(e){
            errors.push(e);
            //console.log(errors);
            return res.status(400).render("trade", {
                title: "Error",
                authenticated: true,
                errors: errors,
            });
        }
    }
    else{
        try{
            stockTransactionCheck = await stockData.sellStock(userId, amount, stockId, time, price);
        }
        catch(e){
            errors.push(e);
            return res.status(400).render("trade", {
                title: "Error",
                authenticated: true,
                errors: errors,
            });
        }
    }
    return res.status(200).render("trade", {currUser: req.session.user });
    //return res.status(200).render("trade");
}
else{
    return res.status(403).redirect('/login');
}
});


module.exports = router;