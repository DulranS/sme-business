"use client"
import React, { useState } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const AddListingPage = () => {
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [mileage, setMileage] = useState('');
  const [transmission, setTransmission] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [year, setYear] = useState('');
  const [image, setImage] = useState('/api/placeholder/400/300');
  const [condition, setCondition] = useState('');
  const [location, setLocation] = useState('');
  const [sold, setSold] = useState(false);
  const [facebookUrl, setFacebookUrl] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await addDoc(collection(db, 'listings'), {
        id,
        title,
        price,
        category,
        mileage,
        transmission,
        fuelType,
        year,
        image,
        condition,
        location,
        sold,
        facebookUrl,
      });

      // Reset form fields
      setId('');
      setTitle('');
      setPrice('');
      setCategory('');
      setMileage('');
      setTransmission('');
      setFuelType('');
      setYear('');
      setImage('/api/placeholder/400/300');
      setCondition('');
      setLocation('');
      setSold(false);
      setFacebookUrl('');
    } catch (error) {
      console.error('Error adding document:', error);
    }
  };

  return (
    <div>
      <h1>Add New Listing</h1>
      <form onSubmit={handleSubmit}>
        <label>
          ID:
          <input
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
          />
        </label>
        <br />
        <label>
          Title:
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <br />
        <label>
          Price:
          <input
            type="text"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <br />
        <label>
          Category:
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </label>
        <br />
        <label>
          Mileage:
          <input
            type="text"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
          />
        </label>
        <br />
        <label>
          Transmission:
          <input
            type="text"
            value={transmission}
            onChange={(e) => setTransmission(e.target.value)}
          />
        </label>
        <br />
        <label>
          Fuel Type:
          <input
            type="text"
            value={fuelType}
            onChange={(e) => setFuelType(e.target.value)}
          />
        </label>
        <br />
        <label>
          Year:
          <input
            type="text"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </label>
        <br />
        <label>
          Image URL:
          <input
            type="text"
            value={image}
            onChange={(e) => setImage(e.target.value)}
          />
        </label>
        <br />
        <label>
          Condition:
          <input
            type="text"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
          />
        </label>
        <br />
        <label>
          Location:
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </label>
        <br />
        <label>
          Sold:
          <input
            type="checkbox"
            checked={sold}
            onChange={(e) => setSold(e.target.checked)}
          />
        </label>
        <br />
        <label>
          Facebook URL:
          <input
            type="text"
            value={facebookUrl}
            onChange={(e) => setFacebookUrl(e.target.value)}
          />
        </label>
        <br />
        <button type="submit">Add Listing</button>
      </form>
    </div>
  );
};

export default AddListingPage;