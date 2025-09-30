"use client";
import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";
import { useRouter } from "next/router";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import { Textarea } from "./components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert";
import { Navigation } from "./components/navigation";
import { Footer } from "./components/footer";
import { HeroPage } from "./components/hero";
import { Services } from "./components/services";

import ContactComponent, { Contact } from "./components/contact";
import PricingPackages from "./components/pricing";
import { WhyChooseSpeedLabs } from "./components/why";
import { FAQ } from "./components/faq";
import { Resend } from "resend";
import { TheGallery } from "./components/gallery";
import { leads } from "./leads/LeadList";

const SpeedLabsApp = () => {
  // const [leads, setLeads] = useState(null);

  // Fetch leads from Firestore
  // useEffect(() => {
  //   const fetchLeads = async () => {
  //     const querySnapshot = await getDocs(collection(db, "leads"));
  //     setLeads(querySnapshot.docs.map((doc) => doc.data()));
  //   };
  //   fetchLeads();
  // }, []);

  // Function to handle form submission

  // const handleSubmit = async (data) => {
  //   try {
  //     const response = await fetch('/api/submit-lead', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify(data),
  //     });

  //     const result = await response.json();

  //     if (!response.ok) {
  //       throw new Error(result.error || 'Submission failed');
  //     }

  //     alert("Your contact information has been submitted successfully!");
  //   } catch (error) {
  //     console.error("Error in form submission:", error);
  //     alert("There was an error. Please try again.");
  //   }
  // };

  return (
    <div>
      <Navigation />
      <HeroPage />
      <WhyChooseSpeedLabs />
      <TheGallery leads={leads} />
      <Services />
      <ContactComponent />
      <FAQ />
      <Footer />
    </div>
  );
};

export default SpeedLabsApp;
