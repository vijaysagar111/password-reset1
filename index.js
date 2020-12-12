const mongodb = require("mongodb");
const express = require("express");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const cors = require("cors");
const nodemailer = require("nodemailer");

const mongoClient = mongodb.MongoClient;
const objectId = mongodb.ObjectID;
const app = express();
let port = process.env.PORT || 3000;
app.listen(port, () => console.log(`The app is running on port: ${port}`));
app.use(express.json());
app.use(cors());
dotenv.config();

const url = process.env.DB_URL;
var transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.email,
    pass: process.env.mailPassword,
  },
});
const mailOptions = {
  from: process.env.email, // sender address
  to: "", // list of receivers
  subject: "Password reset", // Subject line
  html: "", // plain text body
};

let sampleMail = `<p>Hi, </p>
                 <p>Please click on below link to reset password</p>
                 <a target="blank" href="urlToBeReplaced">Click Here!</a>
                 <p>Regards</p>`;

let activateMail = '<p>Hi, </p>'
                 +'<p>Please click on below link to activate your account</p>'
                 +'<a target="blank" href="urlToBeReplaced">Click Here!</a>'
                 +'<p>Regards</p>'
                                  
app.put("/reset-password", async (req, res) => {
  try {
    let client = await mongodb.connect(url);
    let db = client.db("email_db");
    let data = await db.collection("users").findOne({ email: req.body.email });
    let salt = await bcrypt.genSalt(8);
    if (data) {
      let randomStringData = { randomString: salt };
      await db
        .collection("users")
        .findOneAndUpdate(
          { email: req.body.email },
          { $set: randomStringData }
        );
      mailOptions.to = req.body.email;
      let resetURL = process.env.resetURL;
      resetURL = resetURL + "?id=" + data._id + "&rs=" + salt;
      let resultMail = sampleMail;
      resultMail = resultMail.replace("urlToBeReplaced", resetURL);
      mailOptions.html = resultMail;

      await transporter.sendMail(mailOptions);

      res.status(200).json({
        message: "Verification mail sent",
      });
    } else {
      res.status(400).json({
        message: "User is not registered",
      });
    }
    client.close();
  } catch (error) {
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
});

app.put("/change-password/:id", async (req, res) => {
  try {
    let client = await mongoClient.connect(url);
    let db = client.db("email_db");
    let salt = await bcrypt.genSalt(10);
    let hash = await bcrypt.hash(req.body.password, salt);
    req.body.password = hash;
    let result = await db
      .collection("users")
      .findOneAndUpdate({ _id: objectId(req.params.id) }, { $set: req.body });
    res.status(200).json({
      message: "Password Changed Successfully",
    });
    client.close();
  } catch (error) {
    res.status(500).json({
      message: "Error while changing the password",
    });
  }
});

app.post("/register", async (req, res) => {
  try{
    let client = await mongodb.connect(url);
    let db = client.db("email_db");
    let data = await db.collection("users").findOne({ email: req.body.email });
    
    if (data) {
      res.status(400).json({
        message: "User already exists",
      });
    } else {
      let salt = await bcrypt.genSalt(10);
      let hash = await bcrypt.hash(req.body.password, salt);
      req.body.password = hash;
      let reqData = req.body
     
      reqData["activateString"] = salt;
      let result = await db.collection("users").insertOne(reqData);
        
        data = await db.collection("users").findOne({ email: req.body.email });
        mailOptions.to = req.body.email
        mailOptions.subject = "Activation mail"
        let activateURL = process.env.activateURL
        activateURL = activateURL+"?id="+data._id+"&ac="+ salt
        let resultMail = activateMail
        resultMail = resultMail.replace("urlToBeReplaced", activateURL)
        mailOptions.html = resultMail
        
        await transporter.sendMail(mailOptions)
       
        res.status(200).json({
          message: "Activation mail sent",
        });
    }
    client.close();
  }
  catch(err){
    res.send(err);
  }
});

app.post("/login", async (req, res) => {
  try {
    let client = await mongodb.connect(url);
    let db = client.db("email_db");
    let data = await db.collection("users").findOne({ email: req.body.email });
    if (data) {
      let isValid = await bcrypt.compare(req.body.password, data.password);
      if (isValid) {
        res.status(200).json({ message: "Login success" });
      } else {
        res.status(401).json({ message: "Incorrect Email/Password." });
      }
    } else {
      res.status(400).json({
        message: "User is not registered",
      });
    }
    client.close();
  } catch (error) {
    res.status(500).json({
      message: "Server Error! Try again Later.",
    });
  }
});

app.post("/password-reset", async (req, res) => {
  try {
    let client = await mongodb.connect(url);
    let db = client.db("email_db");
    let data = await db
      .collection("users")
      .findOne({ _id: objectId(req.body.objectId) });
    if (data.randomString === req.body.randomString) {
      res.status(200).json({ message: "Verification success" });
    } else {
      res.status(401).json({
        message: "You are not authorized",
      });
    }
    client.close();
  } catch (error) {
    res.status(500).json({
      message: "Internl Server Error",
    });
  }
});

app.post("/activate_account", async (req, res) => {
  try {
    let client = await mongodb.connect(url);
    let db = client.db("email_db");
    let data = await db.collection("users").findOne({ _id: objectId(req.body.objectId) });
    if (data.activateString === req.body.randomString) {
      let activation = {isActivated : "true"}
      await db.collection("students").findOneAndUpdate({_id: objectId(req.params.id)}, {$set :activation})
      res.status(200).json({ message: "Verification success" });
    } else {
      res.status(401).json({
        message: "You are not authorized",
      });
    }
    client.close();
  } catch (error) {
    res.status(500).json({
        message: "Internal Server Error"
    });
  }



});