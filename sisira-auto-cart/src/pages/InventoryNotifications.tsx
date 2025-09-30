import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistance } from "date-fns";
import { AlertCircle, Download } from "lucide-react";

export function InventoryNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    productId: "",
    notified: "all",
  });

  const apiURL = "https://sisira-auto-cart.onrender.com";

  // Fetch notifications on load and when filters/pagination change
  useEffect(() => {
    fetchNotifications();
  }, [pagination.page, filters]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.pageSize.toString(),
        notified: filters.notified,
      });

      if (filters.productId) {
        queryParams.append("productId", filters.productId);
      }

      const response = await fetch(
        `${apiURL}/api/inventory-notifications?${queryParams}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const data = await response.json();
      setNotifications(data.notifications);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotifications = async (productId) => {
    const id = productId
    try {
      const response = await fetch(
        `${apiURL}/api/products/${id}/send-inventory-notifications`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to send notifications");
      }

      // Refresh the list after successful sending
      fetchNotifications();
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePageChange = (newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page when filters change
  };

  // Function to export notifications data to CSV
  const exportToCSV = () => {
    // Define the CSV headers
    const headers = [
      "Contact",
      "Product Name",
      "Product ID",
      "SKU",
      "Brand",
      "Category",
      "Subcategory",
      "Status",
      "Created At"
    ].join(",");

    // Map notifications to CSV rows
    const csvRows = notifications.map(notification => {
      // Format each field and escape commas
      const contact = `"${notification.contact || ""}"`;
      const productName = `"${notification.productName || ""}"`;
      const productId = `"${notification.productId || ""}"`;
      const productSku = `"${notification.productSku || ""}"`;
      const productBrand = `"${notification.productBrand || ""}"`;
      const productCategory = `"${notification.productCategory || ""}"`;
      const productSubcategory = `"${notification.productSubcategory || ""}"`;
      const status = notification.hasBeenNotified ? "Sent" : "Pending";
      const createdAt = notification.createdAt ? new Date(notification.createdAt).toISOString() : "";

      return [
        contact,
        productName,
        productId,
        productSku,
        productBrand,
        productCategory,
        productSubcategory,
        status,
        createdAt
      ].join(",");
    });

    // Combine headers and rows
    const csvContent = [headers, ...csvRows].join("\n");

    // Create and download the CSV file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `inventory-notifications-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Responsive rendering for different screen sizes
  const renderNotificationsList = () => {
    if (loading) {
      return <div className="text-center py-8">Loading notifications...</div>;
    }

    if (notifications.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No notifications found.
        </div>
      );
    }

    // For larger screens - table view
    return (
      <>
        {/* Hide on small screens, show on medium and up */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Sub Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.map((notification) => (
                <TableRow key={notification.id}>
                  <TableCell className="max-w-xs truncate">
                    {notification.contact}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {notification.productName}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {notification.createdAt &&
                      formatDistance(
                        new Date(notification.createdAt),
                        new Date(),
                        { addSuffix: true }
                      )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {notification.productBrand}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {notification.productCategory}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {notification.productSubcategory}
                  </TableCell>
                  <TableCell>
                    {notification.hasBeenNotified ? (
                      <Badge className="bg-green-100 text-green-800">
                        Sent
                      </Badge>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-800">
                        Pending
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell>
                    {!notification.hasBeenNotified && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleSendNotifications(notification.productId)
                        }
                      >
                        Send
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Show on small screens, hide on medium and up - card view */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {notifications.map((notification) => (
            <Card key={notification.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="truncate max-w-xs mr-2">
                    <p className="font-medium">{notification.contact}</p>
                    <p className="text-xs text-gray-500 font-mono mt-1">
                      {notification.productId}
                    </p>
                  </div>
                  {notification.hasBeenNotified ? (
                    <Badge className="bg-green-100 text-green-800">Sent</Badge>
                  ) : (
                    <Badge className="bg-yellow-100 text-yellow-800">
                      Pending
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-gray-500 mt-2">
                  {notification.createdAt &&
                    formatDistance(
                      new Date(notification.createdAt),
                      new Date(),
                      { addSuffix: true }
                    )}
                </div>
                {!notification.hasBeenNotified && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() =>
                      handleSendNotifications(notification.productId)
                    }
                  >
                    Send Notification
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-semibold">
            Inventory Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Responsive filter layout with export button */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6 justify-between">
            {/* <div className="w-full sm:w-1/2 md:w-1/3">
              <label className="block text-sm font-medium mb-1">
                Notification Status
              </label>
              <Select
                value={filters.notified}
                onValueChange={(value) => handleFilterChange("notified", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Notifications</SelectItem>
                  <SelectItem value="true">Sent Notifications</SelectItem>
                  <SelectItem value="false">Pending Notifications</SelectItem>
                </SelectContent>
              </Select>
            </div> */}
            
            {/* Export to CSV button */}
            <div className="flex items-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportToCSV}
                disabled={notifications.length === 0}
                className="flex items-center"
              >
                <Download className="h-4 w-4 mr-2" />
                Export to CSV
              </Button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              <span>Error: {error}</span>
            </div>
          )}

          {renderNotificationsList()}

          {/* Responsive pagination */}
          {notifications.length > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-sm text-gray-500">
                Showing {notifications.length} of {pagination.total}{" "}
                notifications
              </div>
              <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm whitespace-nowrap">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}