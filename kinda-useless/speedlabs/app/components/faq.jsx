import React, { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import Link from "next/link";

export const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      question: "What services does Speed Labs offer?",
      answer:
        "We specialize in car videography, professional photography, and tailored marketing campaigns to help you sell your car seamlessly.",
    },
    {
      question: "How do I list my car with Speed Labs?",
      answer:
        "Simply get in touch with us through our contact form or give us a call. We'll handle everything from photography to marketing for you.",
    },
    {
      question: "How long does the process take?",
      answer:
        "The time frame depends on the scope of services required. Typically, it takes 3-5 business days to prepare your listing and launch marketing campaigns.",
    },
    {
      question: "What are the costs involved?",
      answer:
        "Our pricing is flexible based on the services you choose. Contact us for a personalized quote.",
    },
    {
      question: "Can I sell multiple cars at once?",
      answer:
        "Absolutely! Whether you're selling a single car or an entire fleet, we can manage it all for you.",
    },
  ];

  const toggleAnswer = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section
      className="bg-gradient-to-br from-red-100 via-white to-red-50 py-24"
      id="faq"
    >
      <div className="container mx-auto px-6 max-w-4xl">
        <div className="text-center mb-16">
          <div className="inline-block">
            <div className="flex items-center justify-center mb-6">
              <Sparkles className="w-8 h-8 text-red-600 mr-2" />
              <h2 className="text-4xl lg:text-5xl font-extrabold bg-gradient-to-r from-red-600 to-red-400 inline-block text-transparent bg-clip-text">
                Frequently Asked Questions
              </h2>
              <Sparkles className="w-8 h-8 text-red-400 ml-2" />
            </div>
            <p className="text-xl text-red-700 max-w-2xl mx-auto">
              Find answers to common questions about our services and process
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="group bg-white/90 backdrop-blur-sm rounded-xl shadow-lg 
                         hover:shadow-xl transition-all duration-300 border-2 
                         border-transparent hover:border-red-300"
            >
              <button className="w-full" onClick={() => toggleAnswer(index)}>
                <div className="flex items-center justify-between p-6 cursor-pointer">
                  <h3
                    className="text-xl font-bold text-red-800 text-left group-hover:text-red-500 
                               transition-colors duration-300"
                  >
                    {faq.question}
                  </h3>
                  <div
                    className={`w-8 h-8 rounded-full bg-gradient-to-r from-red-600 to-red-400 
                                 flex items-center justify-center transform transition-transform duration-300
                                 ${openIndex === index ? "rotate-180" : "rotate-0"}`}
                  >
                    <ChevronDown className="w-5 h-5 text-white" />
                  </div>
                </div>

                <div
                  className={`px-6 transition-all duration-500 ease-in-out overflow-hidden
                             ${
                               openIndex === index
                                 ? "pb-6 opacity-100"
                                 : "max-h-0 opacity-0"
                             }`}
                  style={{
                    maxHeight: openIndex === index ? "1000px" : "0",
                  }}
                >
                  <div className="text-red-700 text-lg leading-relaxed">
                    {faq.answer}
                  </div>
                  <div className="mt-4 h-1 w-12 bg-gradient-to-r from-red-600 to-red-400 rounded-full" />
                </div>
              </button>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-red-700 text-lg mb-6">
            Still have questions? We're here to help!
          </p>
          <Link href={"#footer"}
            className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-400 text-white 
                           font-bold rounded-xl shadow-lg hover:shadow-2xl transform hover:scale-105 
                           transition-all duration-300 hover:from-red-700 hover:to-red-500"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
