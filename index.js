const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


app.use(express.json())
app.use(cors());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.56yvv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
  
    await client.connect();

    const Db = client.db('Ayira-Database');
    const usersCollection = Db.collection('All-Users');


    // ------- users relatd api--------
    // post all users 
       app.post('/api/post-users' , async(req,res) => {
          const user = req.body;
          // if user already sign up
          const query = {email : user.email};
          const userAlradyExist = await usersCollection.findOne(query);
          if(userAlradyExist){
            return  res.send({meassage : 'u are already Registerd. please log in', insertedId : null});
          }

          const  result =  await usersCollection.insertOne(user);
          res.send(result)
    })

    //  find all users 
    app.get('/api/find-all-users', async(req,res) => { 
         const result = await usersCollection.find().toArray();
         res.send(result)
    })


    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

  }
}
run().catch(console.dir);




app.get('/', (req,res) => {
    res.send('ayira server is running')
});


// Address Post API
app.post('/address', async (req, res) => {
  try {
    const address = req.body; // form data comes here
    const addressCollection = client.db('Ayira-Database').collection('address');
    const result = await addressCollection.insertOne(address);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});


// Address Get API
app.get('/address', async (req, res) => {
  try {
    const addressCollection = client.db('Ayira-Database').collection('address');
    const addresses = await addressCollection.find().toArray();
    res.send(addresses);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});



app.listen(port, () => {
     console.log('ayira server is running on port', port);
     
})