import {
  ArrowRight,
  Camera,
  Eye,
  FileText,
  Globe,
  Link,
  Video,
} from "lucide-react";

export const Services = () => {
  const services = [
    {
      icon: Camera,
      title: "Photography",
      description:
        "Our skilled photographers capture high-quality images that highlight your car's best features, using advanced lighting and angles to create eye-catching photos that attract serious buyers.",
      gradient: "from-red-500 to-red-600",
    },
    {
      icon: Video,
      title: "Videography",
      description:
        "We produce engaging video content that gives potential buyers a virtual tour of your car. Our videography focuses on dynamic angles, smooth transitions, and close-ups to showcase unique details.",
      gradient: "from-red-400 to-red-500",
    },
    {
      icon: Eye,
      title: "360° Interior View",
      description:
        "Our 360° interior view service provides an interactive experience, allowing buyers to explore the car's interior from every angle. This immersive view boosts buyer confidence and interest.",
      gradient: "from-red-600 to-red-700",
    },
    {
      icon: FileText,
      title: "Full Details Caption",
      description:
        "We craft comprehensive captions that include all key details and selling points, ensuring buyers get a clear picture of the car's value and specifications, helping to drive informed inquiries.",
      gradient: "from-red-500 to-red-600",
    },
    {
      icon: Globe,
      title: "Listing Management",
      description:
        "Our team manages your car's listing across top platforms, optimizing visibility to reach a larger audience. We handle everything from posting to responding to inquiries, simplifying the process.",
      gradient: "from-red-600 to-red-700",
    },
  ];

  return (
    <div
      className="py-24 bg-gradient-to-br from-red-50 via-red-100 to-red-50"
    >
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-extrabold mb-6 bg-gradient-to-r from-red-600 to-red-800 inline-block text-transparent bg-clip-text">
            Our Premium Services
          </h2>
          <p className="text-xl text-red-700 max-w-3xl mx-auto">
            We offer a comprehensive suite of premium services designed to make
            selling your car seamless, attractive, and successful.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <div
              key={index}
              className="group bg-white/90 backdrop-blur-sm p-8 rounded-xl shadow-lg 
                         hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2
                         border-2 border-transparent hover:border-red-200"
            >
              <div className="relative">
                <div
                  className={`absolute inset-0 bg-gradient-to-r ${service.gradient} blur-2xl opacity-20 
                                group-hover:opacity-30 transition-opacity duration-500 rounded-full`}
                />
                <div
                  className={`relative bg-gradient-to-r ${service.gradient} p-4 rounded-xl inline-block
                                shadow-lg group-hover:scale-110 transition-transform duration-500`}
                >
                  <service.icon className="w-8 h-8 text-white" />
                </div>
              </div>

              <h3
                className="text-2xl font-bold text-red-800 mt-6 mb-4 group-hover:text-red-600 
                           transition-colors duration-300"
              >
                {service.title}
              </h3>

              <p className="text-red-700 leading-relaxed mb-6">
                {service.description}
              </p>

              <button
                className={`flex items-center text-sm font-semibold bg-gradient-to-r ${service.gradient} 
                                bg-clip-text text-transparent group-hover:gap-2 transition-all duration-300`}
              >
                <ArrowRight
                  className={`w-4 h-4 inline-block ml-1 opacity-0 group-hover:opacity-100 
                                                transition-all duration-300 ${service.gradient}`}
                />
              </button>

              <div
                className="mt-6 h-1 w-12 bg-gradient-to-r from-red-500 to-red-700 rounded-full 
                            group-hover:w-full transition-all duration-500"
              />
            </div>
          ))}
        </div>

        {/* <div className="mt-16 text-center">
          <Link
            href="#contact"
            className="inline-flex px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white 
                           font-bold rounded-xl shadow-lg hover:shadow-2xl transform hover:scale-105 
                           transition-all duration-300 hover:from-red-700 hover:to-red-800
                           items-center gap-2"
          >
            Get Started Now
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div> */}
      </div>
    </div>
  );
};
