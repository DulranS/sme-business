// app/api/submit-lead/route.js
import { Resend } from "resend";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Resend configuration
const resend = new Resend("yourkey123");

// Next.js 13 API route handler
export async function POST(req) {
  try {
    const data = await req.json();

    // Basic validation
    if (!data.name || !data.phone || !data.package) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400 }
      );
    }

    // Add to Firestore
    const docRef = await addDoc(collection(db, "leads"), {
      name: data.name,
      email: data.email || "",
      phone: data.phone,
      package: data.package,
      addons: data.addons || {},
      message: data.message || "",
      totalPrice: data.totalPrice || 0,
      createdAt: serverTimestamp(),
    });

    // Send email notification
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "youremail.lk@gmail.com",
      subject: "New Lead Submission",
      html: `
        <h2>New Lead Details</h2>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email || "Not provided"}</p>
        <p><strong>Phone:</strong> ${data.phone}</p>
        <p><strong>Package:</strong> ${data.package}</p>
        <p><strong>Total Price:</strong> ${data.totalPrice || 0}</p>
        ${data.message ? `<p><strong>Message:</strong> ${data.message}</p>` : ""}
        <p><strong>Addons:</strong> ${JSON.stringify(data.addons || {})}</p>
      `,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Lead submitted successfully",
        leadId: docRef.id,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error processing submission:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
