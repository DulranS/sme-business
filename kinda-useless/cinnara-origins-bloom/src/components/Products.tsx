import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Leaf, TreePine, Palmtree } from "lucide-react";
import teaLeaves from "@/assets/tea-leaves.jpg";
import cinnamonRaw from "@/assets/cinnamon-raw.jpg";
import kingCoconuts from "@/assets/king-coconuts.jpg";

const Products = () => {
  const products = [
    {
      icon: <Leaf className="text-natural" size={32} />,
      title: "Premium Tea Leaves",
      description: "Raw Ceylon tea leaves from high-altitude plantations",
      image: teaLeaves,
      features: ["BOPF Grade", "Hand-picked", "Estate Fresh", "Export Quality"],
      origins: "Nuwara Eliya & Kandy regions"
    },
    {
      icon: <TreePine className="text-cinnamon" size={32} />,
      title: "Ceylon Cinnamon",
      description: "Authentic raw cinnamon bark and quills",
      image: cinnamonRaw,
      features: ["True Ceylon", "Low Coumarin", "Premium Grade", "Organic Available"],
      origins: "Southern coastal regions"
    },
    {
      icon: <Palmtree className="text-golden" size={32} />,
      title: "King Coconuts",
      description: "Fresh king coconuts and coconut products",
      image: kingCoconuts,
      features: ["Fresh Harvest", "Natural Electrolytes", "Various Sizes", "Seasonal Supply"],
      origins: "Coconut Triangle regions"
    }
  ];

  return (
    <section id="products" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-gradient-golden text-white border-none font-subheading" variant="secondary">Our Premium Range</Badge>
          <h2 className="font-heading text-5xl md:text-6xl font-bold text-foreground mb-6 text-gradient-exotic">
            Ceylon's Finest Exports
          </h2>
          <p className="font-subheading text-xl text-muted-foreground max-w-3xl mx-auto italic">
            We specialize in three exceptional products that represent the best of Sri Lankan agriculture and tradition.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product, index) => (
            <Card key={index} className="group hover:shadow-exotic transition-all duration-700 border-golden/20 overflow-hidden bg-gradient-to-br from-cream/50 to-background animate-fade-in backdrop-blur-sm">
              <div className="relative h-64 overflow-hidden">
                <img 
                  src={product.image}
                  alt={product.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent group-hover:from-black/20 transition-all duration-500"></div>
                <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm p-3 rounded-lg border border-golden/20 group-hover:shadow-glow transition-all duration-500">
                  {product.icon}
                </div>
                <div className="absolute bottom-4 right-4 bg-gradient-golden text-white px-3 py-1 rounded-full text-xs font-semibold tracking-wide">
                  Premium Grade
                </div>
              </div>
              
              <CardHeader className="pb-4">
                <CardTitle className="font-heading text-2xl text-foreground mb-2 group-hover:text-gradient-luxury transition-all duration-500">{product.title}</CardTitle>
                <CardDescription className="font-subheading text-lg italic">{product.description}</CardDescription>
                <div className="text-sm text-muted-foreground mt-2 font-body">
                  <strong className="text-golden">Origin:</strong> {product.origins}
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Key Features:</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {product.features.map((feature, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs justify-center">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <Button variant="exotic" className="w-full mt-6 font-heading">
                    Request Quote
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-16 bg-gradient-luxury p-8 rounded-2xl border border-golden/20">
          <p className="font-subheading text-muted-foreground mb-6 text-lg italic">
            Looking for bulk orders or custom specifications?
          </p>
          <Button variant="premium" size="lg" className="font-heading">
            Contact Our Export Team
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Products;