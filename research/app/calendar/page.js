"use client";
import Link from "next/link";
import React, { useState } from "react";

const Page = () => {
  const [country, setCountry] = useState("US");
  const [year, setYear] = useState("2024");
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);

  const countries = ["US", "CA", "GB", "AU", "IN"]; // Example countries
  const years = ["2020", "2021", "2022", "2023", "2024", "2025"];

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const apiUrl = `https://api.api-ninjas.com/v1/holidays?country=${country}&year=${year}`;
      const response = await fetch(apiUrl, {
        headers: {
          'X-Api-Key': process.env.holidayKey // Replace with your actual API key
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      const holidaysMapped = data.reduce((acc, holiday) => {
        acc[holiday.name] = holiday.date;
        return acc;
      }, {});
      setHolidays(holidaysMapped);
    } catch (error) {
      console.error("Error fetching holidays:", error);
      setHolidays([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchHolidays();
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4 text-black">Holiday Finder</h1>
      <Link href={"/"}>Back to Homepage</Link>
      <br /> <br />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-4">
        <div className="flex gap-4">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="p-2 border rounded text-black" // Ensuring black text color
          >
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="p-2 border rounded text-black" // Ensuring black text color
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Find Holidays
        </button>
      </form>

      {loading ? (
        <p className="text-black">Loading holidays...</p>
      ) : (
        <ul className="text-black">
          {Object.entries(holidays).map(([name, date], index) => (
            <li key={index} className="mb-2">
              <strong>{name}</strong> - {date}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Page;
