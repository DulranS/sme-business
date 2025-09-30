import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Shield, Truck, Users } from "lucide-react";

const About = () => {
  const features = [
    {
      icon: <Award className="text-golden" size={32} />,
      title: "Quality Certified",
      description: "ISO 22000, HACCP, and organic certifications ensuring the highest standards."
    },
    {
      icon: <Shield className="text-cinnamon" size={32} />,
      title: "Trusted Heritage",
      description: "Three generations of expertise in Ceylon export trade with proven track record."
    },
    {
      icon: <Truck className="text-natural" size={32} />,
      title: "Global Logistics",
      description: "Seamless shipping to 25+ countries with proper documentation and handling."
    },
    {
      icon: <Users className="text-accent" size={32} />,
      title: "Farmer Network",
      description: "Direct partnerships with local farmers ensuring fair trade and fresh products."
    }
  ];

  return (
    <section id="about" className="py-24">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div className="animate-fade-in">
            <Badge className="mb-4 bg-gradient-spice text-white border-none font-subheading" variant="secondary">About Cinnara Origins</Badge>
            <h2 className="font-heading text-5xl md:text-6xl font-bold text-foreground mb-8 text-gradient-exotic">
              Your Trusted Ceylon Export Partner
            </h2>
            <div className="space-y-6 text-lg text-muted-foreground font-body leading-relaxed">
              <p className="first-letter:text-6xl first-letter:font-heading first-letter:text-gradient-luxury first-letter:float-left first-letter:mr-3 first-letter:mt-1">
                For over two decades, Cinnara Origins has been at the forefront of Sri Lankan agricultural exports, 
                bringing the authentic taste and quality of Ceylon to international markets.
              </p>
              <p>
                Our commitment to excellence spans from the careful selection of raw materials to the final 
                delivery at your doorstep. We work directly with local farmers and cooperatives, ensuring 
                sustainable practices and fair trade principles.
              </p>
              <p>
                Whether you're a distributor, retailer, or manufacturer, we provide consistent quality, 
                competitive pricing, and reliable delivery schedules that you can count on.
              </p>
            </div>

            <div className="mt-10 p-8 bg-gradient-luxury rounded-2xl border-2 border-golden/30 shadow-luxury">
              <h3 className="font-heading text-2xl font-semibold text-foreground mb-4 text-gradient-exotic">Our Mission</h3>
              <p className="text-muted-foreground font-subheading italic text-lg leading-relaxed">
                To preserve and share the authentic flavors of Ceylon while supporting local communities 
                and sustainable agricultural practices worldwide.
              </p>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid sm:grid-cols-2 gap-6 animate-scale-in">
            {features.map((feature, index) => (
              <Card key={index} className="border-golden/20 hover:shadow-luxury transition-all duration-500 group bg-gradient-to-br from-cream/30 to-background backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <div className="mb-4 flex justify-center group-hover:scale-110 transition-transform duration-500 exotic-glow">
                    {feature.icon}
                  </div>
                  <h3 className="font-heading text-xl font-semibold text-foreground mb-3 group-hover:text-gradient-luxury transition-all duration-500">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground font-body">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Stats Section */}
        <div className="mt-20 p-12 bg-gradient-exotic rounded-3xl border-2 border-ceylon-gold/50 shadow-glow relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent shimmer"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center relative z-10">
            <div className="group hover:scale-105 transition-transform duration-300">
              <div className="font-heading text-4xl md:text-5xl font-bold text-white mb-3 exotic-glow">28 Years</div>
              <div className="text-white/90 font-subheading italic">Industry Experience</div>
            </div>
            <div className="group hover:scale-105 transition-transform duration-300">
              <div className="font-heading text-4xl md:text-5xl font-bold text-white mb-3 exotic-glow">500+</div>
              <div className="text-white/90 font-subheading italic">Partner Farmers</div>
            </div>
            <div className="group hover:scale-105 transition-transform duration-300">
              <div className="font-heading text-4xl md:text-5xl font-bold text-white mb-3 exotic-glow">50M+</div>
              <div className="text-white/90 font-subheading italic">Kg Exported Annually</div>
            </div>
            <div className="group hover:scale-105 transition-transform duration-300">
              <div className="font-heading text-4xl md:text-5xl font-bold text-white mb-3 exotic-glow">100%</div>
              <div className="text-white/90 font-subheading italic">Client Satisfaction</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;