const mockReviews = [
  {
    id: 1,
    user: "Alex T.",
    rating: 5,
    date: "2025-03-12",
    title: "Perfect fit for my vehicle",
    content:
      "This part was exactly what I needed. Installation was smooth and it works perfectly. Would definitely buy again!",
    helpful: 24,
    verified: true,
  },
  {
    id: 2,
    user: "Jamie L.",
    rating: 4,
    date: "2025-03-01",
    title: "Good quality, shipping was quick",
    content:
      "The part quality is excellent. Deducting one star because the installation instructions could have been clearer.",
    helpful: 15,
    verified: true,
  },
  {
    id: 3,
    user: "Sam K.",
    rating: 5,
    date: "2025-02-22",
    title: "Solved my issue immediately",
    content:
      "Had an ongoing issue with my vehicle for months. Installed this part and everything works perfectly now. Great value for money!",
    helpful: 32,
    verified: true,
  },
];

// FAQs
const productFAQs = [
  {
    question: "How long is the warranty period?",
    answer:
      "This product comes with a 2-year manufacturer warranty covering defects in materials and workmanship under normal use.",
  },
  {
    question: "Is professional installation required?",
    answer:
      "While professional installation is recommended for optimal performance, this product can be installed by experienced DIY mechanics. We provide detailed installation instructions with each purchase.",
  },
  {
    question: "Is this part compatible with all model years?",
    answer:
      "This part is compatible with model years 2018-2025. For older models, please check our legacy parts section or contact customer support for assistance.",
  },
  {
    question: "What's your return policy?",
    answer:
      "We offer a 30-day return policy for unused parts in original packaging. Please note that custom or special order parts may have different return conditions.",
  },
];

export {mockReviews, productFAQs};