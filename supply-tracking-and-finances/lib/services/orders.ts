// ==============================
// ORDER SERVICE
// ==============================

import { supabase } from './supabase';
import { Order, OrderFormData } from '@/types';
import { parseImages } from '@/lib/utils/helpers';

class OrderService {
  async getAllOrders(): Promise<Order[]> {
    try {
      const data = await supabase.from('orders').select('*').execute();
      return data.sort(
        (a: Order, b: Order) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (error) {
      console.error('Error loading orders:', error);
      return [];
    }
  }

  async getOrdersByStatus(status: Order['status']): Promise<Order[]> {
    try {
      return await supabase.from('orders').select('*').eq('status', status).execute();
    } catch (error) {
      console.error(`Error loading ${status} orders:`, error);
      return [];
    }
  }

  async getOrderById(id: number): Promise<Order | null> {
    try {
      const orders = await supabase.from('orders').select('*').eq('id', id).execute();
      return orders.length > 0 ? orders[0] : null;
    } catch (error) {
      console.error('Error loading order:', error);
      return null;
    }
  }

  async createOrder(formData: OrderFormData): Promise<Order | null> {
    try {
      const orderData = {
        customer_name: formData.customer_name,
        email: formData.email || undefined,
        phone: formData.phone,
        location: formData.location,
        description: formData.description,
        moq: formData.moq,
        urgency: formData.urgency,
        images: JSON.stringify(formData.images),
        status: 'pending' as Order['status'],
        created_at: new Date().toISOString(),
        supplier_price: '',
        supplier_description: '',
        supplier_name: '',
        customer_price: '',
        category: formData.category,
      };

      const result = await supabase.from('orders').insert(orderData).execute();
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('Error creating order:', error);
      return null;
    }
  }

  async updateOrderStatus(orderId: number, newStatus: Order['status']): Promise<boolean> {
    try {
      await supabase.from('orders').update({ status: newStatus }).eq('id', orderId).execute();
      return true;
    } catch (error) {
      console.error('Error updating order status:', error);
      return false;
    }
  }

  async updateOrder(orderId: number, data: Partial<Order>): Promise<boolean> {
    try {
      await supabase.from('orders').update(data).eq('id', orderId).execute();
      return true;
    } catch (error) {
      console.error('Error updating order:', error);
      return false;
    }
  }

  async updateSupplierInfo(
    orderId: number,
    supplierPrice: string,
    supplierDescription: string
  ): Promise<boolean> {
    try {
      await supabase
        .from('orders')
        .update({ supplier_price: supplierPrice, supplier_description: supplierDescription })
        .eq('id', orderId)
        .execute();
      return true;
    } catch (error) {
      console.error('Error updating supplier info:', error);
      return false;
    }
  }

  async deleteOrder(orderId: number): Promise<boolean> {
    try {
      await supabase.from('orders').delete().eq('id', orderId).execute();
      return true;
    } catch (error) {
      console.error('Error deleting order:', error);
      return false;
    }
  }

  async updateShippingInfo(
    orderId: number,
    shippedQuantity: number,
    carrier: string,
    trackingNumber: string,
    status: Order['status']
  ): Promise<boolean> {
    try {
      await supabase
        .from('orders')
        .update({
          shipped_quantity: shippedQuantity,
          shipping_carrier: carrier,
          tracking_number: trackingNumber,
          status,
          shipped_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .execute();
      return true;
    } catch (error) {
      console.error('Error updating shipping info:', error);
      return false;
    }
  }

  async searchOrders(query: string): Promise<Order[]> {
    try {
      const allOrders = await this.getAllOrders();
      const lowerQuery = query.toLowerCase();
      return allOrders.filter(
        (order) =>
          order.customer_name.toLowerCase().includes(lowerQuery) ||
          order.phone.includes(lowerQuery) ||
          order.location.toLowerCase().includes(lowerQuery) ||
          order.description.toLowerCase().includes(lowerQuery) ||
          (order.category && order.category.toLowerCase().includes(lowerQuery))
      );
    } catch (error) {
      console.error('Error searching orders:', error);
      return [];
    }
  }

  async getOrdersByCategory(category: string): Promise<Order[]> {
    try {
      const allOrders = await this.getAllOrders();
      return allOrders.filter((order) => order.category === category);
    } catch (error) {
      console.error('Error loading orders by category:', error);
      return [];
    }
  }

  async getHighPriorityOrders(): Promise<Order[]> {
    try {
      const allOrders = await this.getAllOrders();
      return allOrders.filter(
        (order) => order.urgency === 'high' && order.status !== 'completed' && order.status !== 'cancelled'
      );
    } catch (error) {
      console.error('Error loading high priority orders:', error);
      return [];
    }
  }

  async getAgingOrders(daysThreshold: number = 14): Promise<Order[]> {
    try {
      const allOrders = await this.getAllOrders();
      const now = new Date();
      return allOrders.filter((order) => {
        if (order.status === 'completed' || order.status === 'cancelled') return false;
        const created = new Date(order.created_at);
        const daysSince = Math.ceil((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        return daysSince > daysThreshold;
      });
    } catch (error) {
      console.error('Error loading aging orders:', error);
      return [];
    }
  }

  async getRecurringOrders(): Promise<Order[]> {
    try {
      const allOrders = await this.getAllOrders();
      return allOrders.filter((order) => order.is_recurring && !order.recurring_template_id);
    } catch (error) {
      console.error('Error loading recurring orders:', error);
      return [];
    }
  }
}

export const orderService = new OrderService();
export default OrderService;
