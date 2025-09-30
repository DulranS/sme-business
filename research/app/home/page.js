"use client"
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [ads, setAds] = useState([]);
  const [newAd, setNewAd] = useState({
    platform: '',
    campaign_name: '',
    budget: 0,
    status: 'active'
  });

  useEffect(() => {
    fetchAds();
  }, []);

  const fetchAds = async () => {
    const response = await axios.get('/ads');
    setAds(response.data);
  };

  const handleInputChange = (e) => {
    setNewAd({ ...newAd, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await axios.post('/ads', newAd);
    fetchAds();
    setNewAd({ platform: '', campaign_name: '', budget: 0, status: 'active' });
  };

  return (
    <div>
      <h1>Social Media Ad Manager</h1>
      <form onSubmit={handleSubmit}>
        <input name="platform" value={newAd.platform} onChange={handleInputChange} placeholder="Platform" required />
        <input name="campaign_name" value={newAd.campaign_name} onChange={handleInputChange} placeholder="Campaign Name" required />
        <input name="budget" type="number" value={newAd.budget} onChange={handleInputChange} placeholder="Budget" required />
        <select name="status" value={newAd.status} onChange={handleInputChange}>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
        </select>
        <button type="submit">Add Ad</button>
      </form>
      <ul>
        {ads.map(ad => (
          <li key={ad.id}>
            {ad.platform} - {ad.campaign_name} - ${ad.budget} - {ad.status}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;