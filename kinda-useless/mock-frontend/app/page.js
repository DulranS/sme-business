"use client"
import React, { useRef, useState } from 'react';

export default function JobApplicationForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    cv: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [cvLink, setCvLink] = useState(null); // To store the CV link

  const fileInput = useRef();

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setToast(null);
    setCvLink(null); // Reset CV link on new submission

    const formDataToSend = new FormData();
    formDataToSend.append("name", formData.name);
    formDataToSend.append("email", formData.email);
    formDataToSend.append("phone", formData.phone);
    formDataToSend.append("cv", formData.cv);

    const baseURL = "http://127.0.0.1:5000";
    try {
      const response = await fetch(`${baseURL}/api/submit`, {
        method: "POST",
        body: formDataToSend,
      });

      if (response.ok) {
        const data = await response.json();
        setToast({
          type: 'success',
          message: 'Your application has been submitted successfully!'
        });
        setCvLink(data.cv_link); // Store the CV link
        // Reset form
        setFormData({
          name: "",
          email: "",
          phone: "",
          cv: null,
        });
        // Reset file input
        if (fileInput) fileInput.value = "";
      } else {
        setToast({
          type: 'error',
          message: 'There was an error submitting your application. Please try again.'
        });
      }
    } catch (error) {
      setToast({
        type: 'error',
        message: 'An unexpected error occurred. Please try again later.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = () => {
    if (cvLink) {
      const link = document.createElement('a');
      link.href = cvLink;
      link.download = cvLink.split('/').pop(); // Extract the file name from the URL
      link.click();
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(to bottom, #f0f0f0, #e0e0e0)',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '500px',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        padding: '30px'
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '20px'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'rgba(0,123,255,0.1)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            margin: '0 auto 15px'
          }}>
            📋
          </div>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            marginBottom: '10px'
          }}>Job Application</h2>
          <p style={{
            color: '#6c757d',
            fontSize: '14px'
          }}>
            Fill out the form below to submit your application
          </p>
        </div>

        {toast && (
          <div style={{
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '15px',
            color: toast.type === 'success' ? '#155724' : '#721c24',
            backgroundColor: toast.type === 'success' ? '#d4edda' : '#f8d7da'
          }}>
            {toast.message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label 
              htmlFor="name" 
              style={{ 
                display: 'block', 
                marginBottom: '5px', 
                fontWeight: '600' 
              }}
            >
              Full Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '16px'
              }}
              placeholder="John Doe"
            />
          </div>

          <div>
            <label 
              htmlFor="email" 
              style={{ 
                display: 'block', 
                marginBottom: '5px', 
                fontWeight: '600' 
              }}
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '16px'
              }}
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label 
              htmlFor="phone" 
              style={{ 
                display: 'block', 
                marginBottom: '5px', 
                fontWeight: '600' 
              }}
            >
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '16px'
              }}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div>
            <label 
              htmlFor="cv" 
              style={{ 
                display: 'block', 
                marginBottom: '5px', 
                fontWeight: '600' 
              }}
            >
              Upload CV (PDF/DOCX)
            </label>
            <input
              type="file"
              ref={fileInput}
              id="cv"
              name="cv"
              accept=".pdf,.docx"
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '16px'
              }}
            />
            <p style={{
              marginTop: '5px',
              fontSize: '12px',
              color: '#6c757d'
            }}>
              Maximum file size: 5MB. Accepted formats: PDF, DOCX
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: isSubmitting ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {isSubmitting ? "Submitting..." : "Submit Application"}
          </button>
        </form>

        {cvLink && (
          <div style={{ marginTop: '15px', textAlign: 'center' }}>
            <button
              onClick={handleDownload}
              style={{
                padding: '12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                cursor: 'pointer',
              }}
            >
              Download CV
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
