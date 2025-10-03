import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Ship, FileText, Package, Clock, Globe } from "lucide-react";

const Services = () => {
  const services = [
    {
      icon: <Package className="text-cinnamon" size={32} />,
      title: "Custom Packaging",
      description: "Tailored packaging solutions for your brand requirements",
      features: ["Private labeling", "Custom bag sizes", "Vacuum sealing", "Moisture control"]
    },
    {
      icon: <Ship className="text-natural" size={32} />,
      title: "Global Shipping",
      description: "Worldwide delivery with proper handling and documentation",
      features: ["Air & sea freight", "Temperature controlled", "Full tracking", "Insurance coverage"]
    },
    {
      icon: <FileText className="text-golden" size={32} />,
      title: "Export Documentation",
      description: "Complete paperwork handling for smooth customs clearance",
      features: ["Certificates of origin", "Quality certificates", "Phytosanitary certificates", "Invoice processing"]
    },
    {
      icon: <Clock className="text-accent" size={32} />,
      title: "Timely Delivery",
      description: "Reliable delivery schedules you can depend on",
      features: ["Schedule planning", "Progress tracking", "Early notifications", "Contingency plans"]
    }
  ];

  const certifications = [
    "ISO 22000:2018",
    "HACCP",
    "Organic Ceylon",
    "Fair Trade",
    "EU Organic",
    "USDA Organic"
  ];

  return (
    <section id="services" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge className="mb-4" variant="secondary">Export Services</Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            End-to-End Export Solutions
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            From sourcing to delivery, we handle every aspect of your Ceylon product imports with professional expertise.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {services.map((service, index) => (
            <Card key={index} className="border-border/50 hover:shadow-lg transition-all duration-300 group">
              <CardHeader className="text-center pb-4">
                <div className="mb-4 flex justify-center group-hover:scale-110 transition-transform duration-300">
                  {service.icon}
                </div>
                <CardTitle className="text-xl text-foreground">{service.title}</CardTitle>
                <CardDescription className="text-muted-foreground">
                  {service.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {service.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start space-x-2 text-sm text-muted-foreground">
                      <CheckCircle size={16} className="text-cinnamon mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Process Timeline */}
        <div className="mb-16">
          <h3 className="text-3xl font-bold text-center text-foreground mb-12">Our Export Process</h3>
          <div className="grid md:grid-cols-5 gap-8">
            {[
              { step: "01", title: "Inquiry", desc: "Submit your requirements" },
              { step: "02", title: "Quote", desc: "Receive detailed pricing" },
              { step: "03", title: "Quality Check", desc: "Product sampling & approval" },
              { step: "04", title: "Processing", desc: "Packaging & documentation" },
              { step: "05", title: "Delivery", desc: "Shipping & tracking" }
            ].map((process, index) => (
              <div key={index} className="text-center group">
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-r from-cinnamon to-golden rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                    {process.step}
                  </div>
                  {index < 4 && (
                    <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-cinnamon/30 to-golden/30"></div>
                  )}
                </div>
                <h4 className="font-semibold text-foreground mb-2">{process.title}</h4>
                <p className="text-sm text-muted-foreground">{process.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Certifications */}
        <div className="bg-gradient-to-r from-cinnamon/5 to-golden/5 rounded-2xl p-8 border border-cinnamon/10">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-foreground mb-4">Quality Certifications</h3>
            <p className="text-muted-foreground">
              Our products meet international quality and safety standards
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {certifications.map((cert, index) => (
              <Badge key={index} variant="outline" className="justify-center py-2 px-4 text-center">
                {cert}
              </Badge>
            ))}
          </div>

          <div className="text-center">
            <Button variant="luxury" size="lg" className="font-heading">
              <Globe className="mr-2" size={20} />
              Request Certificates
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Services;