import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Mail, Clock, Send } from "lucide-react";

const Contact = () => {
  const contactInfo = [
    {
      icon: <MapPin className="text-cinnamon" size={24} />,
      title: "Head Office",
      details: ["123 Export Avenue", "Colombo 03, Sri Lanka", "Postal Code: 00300"]
    },
    {
      icon: <Phone className="text-golden" size={24} />,
      title: "Phone & WhatsApp",
      details: ["+94 11 234 5678", "+94 77 123 4567", "24/7 Export Hotline"]
    },
    {
      icon: <Mail className="text-natural" size={24} />,
      title: "Email",
      details: ["exports@cinnaraorigins.com", "info@cinnaraorigins.com", "sales@cinnaraorigins.com"]
    },
    {
      icon: <Clock className="text-accent" size={24} />,
      title: "Business Hours",
      details: ["Mon - Fri: 8:00 AM - 6:00 PM", "Saturday: 9:00 AM - 2:00 PM", "Export inquiries: 24/7"]
    }
  ];

  return (
    <section id="contact" className="py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge className="mb-4" variant="secondary">Get In Touch</Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Start Your Export Journey
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Ready to import premium Ceylon products? Contact our export team for quotes, samples, and partnership opportunities.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-12">
          {/* Contact Information */}
          <div className="lg:col-span-1">
            <h3 className="text-2xl font-bold text-foreground mb-8">Contact Information</h3>
            <div className="space-y-6">
              {contactInfo.map((info, index) => (
                <Card key={index} className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center space-x-3 text-lg">
                      {info.icon}
                      <span>{info.title}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {info.details.map((detail, idx) => (
                      <p key={idx} className="text-muted-foreground text-sm mb-1">
                        {detail}
                      </p>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-8 p-6 bg-gradient-to-r from-golden/10 to-cinnamon/10 rounded-lg border border-golden/20">
              <h4 className="font-semibold text-foreground mb-2">Quick Response Guarantee</h4>
              <p className="text-sm text-muted-foreground">
                We respond to all export inquiries within 2 hours during business hours, 
                and within 24 hours for weekend inquiries.
              </p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-2xl text-foreground">Request Export Quote</CardTitle>
                <p className="text-muted-foreground">
                  Fill out the form below and our export specialists will get back to you with detailed information.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Company Name *
                    </label>
                    <Input placeholder="Your company name" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Contact Person *
                    </label>
                    <Input placeholder="Your full name" />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Email Address *
                    </label>
                    <Input type="email" placeholder="your.email@company.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Phone Number
                    </label>
                    <Input placeholder="+1 (555) 123-4567" />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Country *
                    </label>
                    <Input placeholder="United States" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Products Interested *
                    </label>
                    <Input placeholder="Tea, Cinnamon, King Coconuts" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Quantity Required
                  </label>
                  <Input placeholder="e.g., 1000 kg monthly" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Additional Requirements
                  </label>
                  <Textarea 
                    placeholder="Please specify packaging requirements, certifications needed, delivery terms, or any other special requirements..."
                    rows={4}
                  />
                </div>

                <Button variant="royal" size="lg" className="w-full font-heading">
                  <Send className="mr-2" size={20} />
                  Send Export Inquiry
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  By submitting this form, you agree to our privacy policy. 
                  We'll only use your information to respond to your inquiry.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;