import { Button } from "@/components/ui/button";
import { ArrowRight, Globe } from "lucide-react";
import heroBackground from "@/assets/hero-background.jpg";

const Hero = () => {
  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroBackground}
          alt="Premium Ceylon exports"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-background/40"></div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-32 z-10 relative">
        <div className="max-w-4xl">
          <div className="flex items-center space-x-2 mb-6">
            <Globe className="text-golden" size={24} />
            <span className="text-muted-foreground font-medium tracking-wide">
              Premium Ceylon Exports Since 1995
            </span>
          </div>
          
          <h1 className="font-heading text-6xl md:text-8xl font-bold mb-8 text-foreground leading-tight animate-fade-in">
            <span className="block text-gradient-exotic drop-shadow-lg">
              Authentic Ceylon
            </span>
            <span className="block text-5xl md:text-6xl text-gradient-luxury font-subheading italic">
              Heritage Exports
            </span>
            <span className="block text-3xl md:text-4xl text-muted-foreground font-body font-light tracking-wide">
              Delivered Worldwide Since 1995
            </span>
          </h1>

          <p className="font-subheading text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl leading-relaxed animate-slide-up">
            From the mystical highlands of Sri Lanka, we bring you the world's finest tea leaves, 
            authentic Ceylon cinnamon, and fresh king coconuts. <span className="text-gradient-luxury font-semibold">Quality guaranteed, heritage preserved.</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <Button variant="royal" size="lg" className="text-lg px-8 py-6 font-heading">
              Explore Products <ArrowRight className="ml-2" size={20} />
            </Button>
            <Button variant="luxury" size="lg" className="text-lg px-8 py-6 font-heading">
              Request Catalog
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 pt-12 border-t border-golden/30 animate-scale-in">
            <div className="text-center group hover:scale-105 transition-transform duration-300">
              <div className="text-4xl md:text-5xl font-heading font-bold text-gradient-exotic mb-3 exotic-glow">25+</div>
              <div className="text-muted-foreground font-subheading">Countries Served</div>
            </div>
            <div className="text-center group hover:scale-105 transition-transform duration-300">
              <div className="text-4xl md:text-5xl font-heading font-bold text-gradient-exotic mb-3 exotic-glow">1000+</div>
              <div className="text-muted-foreground font-subheading">Satisfied Clients</div>
            </div>
            <div className="text-center col-span-2 md:col-span-1 group hover:scale-105 transition-transform duration-300">
              <div className="text-4xl md:text-5xl font-heading font-bold text-gradient-exotic mb-3 exotic-glow">99%</div>
              <div className="text-muted-foreground font-subheading">Quality Assured</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;