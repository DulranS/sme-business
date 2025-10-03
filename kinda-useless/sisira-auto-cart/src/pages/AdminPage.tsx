import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductList } from "@/components/admin/product-list";
import { ProductForm } from "@/components/admin/product-form";
import { InventoryNotifications } from "./InventoryNotifications";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("inventory");

  return (
    <MainLayout>
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-8 text-green-700">Admin Panel</h1>

        <Tabs
          defaultValue="inventory"
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="bg-green-100 border border-green-200">
            <TabsTrigger
              value="inventory"
              className="data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=active]:shadow-none text-green-700"
            >
              Inventory Management
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=active]:shadow-none text-green-700"
            >
              Inventory Notifications
            </TabsTrigger>
            <TabsTrigger
              value="add-product"
              className="data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=active]:shadow-none text-green-700"
            >
              Add Product
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="inventory"
            className="space-y-6 border border-green-200 rounded-lg p-6 bg-green-50"
          >
            <ProductList />
          </TabsContent>

          <TabsContent
            value="notifications"
            className="space-y-6 border border-green-200 rounded-lg p-6 bg-green-50"
          >
            <InventoryNotifications />
          </TabsContent>

          <TabsContent
            value="add-product"
            className="border border-green-200 rounded-lg p-6 bg-green-50"
          >
            <ProductForm onSubmit={() => setActiveTab("inventory")} />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}