require('dotenv').config();
const express = require('express');
const hbs = require('hbs');

const app = express();
const port = process.env.PORT;

// Servir contenido estático
app.use( express.static("public") );

// Handebar
app.set('view engine', 'hbs');
hbs.registerPartials( __dirname + "/views/partials" );


app.get('/', (req, res) => {
  res.render( "home" );
})

app.get('/donar/', (req, res) => {
    res.render( "donar" );
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})