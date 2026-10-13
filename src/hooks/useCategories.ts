import { useState, useEffect } from 'react';
import { mutate, newId, select } from '@/lib/local-db';

interface Category {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

const DUPLICATE_NAME_ERROR = 'فيه قسم بنفس الاسم ده بالفعل';

export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCategories = async () => {
    try {
      setIsLoading(true);
      const data = select('categories').sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      setCategories(data.map((row) => ({ ...row, description: row.description || undefined })));
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const addCategory = async (categoryData: { name: string; description?: string }) => {
    try {
      mutate((tables) => {
        const name = categoryData.name.trim();
        if (tables.categories.some((category) => category.name === name)) {
          throw new Error(DUPLICATE_NAME_ERROR);
        }
        const now = new Date().toISOString();
        tables.categories.push({
          id: newId(),
          name,
          description: categoryData.description?.trim() || null,
          created_at: now,
          updated_at: now,
        });
      });

      await loadCategories();
    } catch (error) {
      console.error('Error adding category:', error);
      throw error;
    }
  };

  const updateCategory = async (id: string, updates: { name?: string; description?: string }) => {
    try {
      mutate((tables) => {
        const category = tables.categories.find((entry) => entry.id === id);
        if (!category) throw new Error('القسم مش موجود');

        const name = updates.name?.trim();
        if (name && tables.categories.some((entry) => entry.id !== id && entry.name === name)) {
          throw new Error(DUPLICATE_NAME_ERROR);
        }
        if (name) category.name = name;
        if (updates.description !== undefined) category.description = updates.description.trim() || null;
        category.updated_at = new Date().toISOString();
      });

      await loadCategories();
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      mutate((tables) => {
        tables.categories = tables.categories.filter((category) => category.id !== id);
        // Products keep existing, just without a category.
        tables.products.forEach((product) => {
          if (product.category === id) product.category = null;
        });
      });

      await loadCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  };

  return {
    categories,
    isLoading,
    addCategory,
    updateCategory,
    deleteCategory,
    refreshCategories: loadCategories
  };
};
