import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Column<T> {
  key: string;
  title: string;
  render?: (record: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  onEdit?: (record: T) => void;
  onDelete?: (id: string) => void;
  emptyText?: string;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  onEdit,
  onDelete,
  emptyText = '暂无数据',
  className,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-32 text-muted-foreground', className)}>
        {emptyText}
      </div>
    );
  }

  return (
    <div className={cn('rounded-md border', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map(col => (
              <TableHead key={col.key} className={col.className}>{col.title}</TableHead>
            ))}
            {(onEdit || onDelete) && <TableHead className="w-[100px]">操作</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map(record => (
            <TableRow key={record.id}>
              {columns.map(col => (
                <TableCell key={col.key} className={col.className}>
                  {col.render ? col.render(record) : (record as any)[col.key]}
                </TableCell>
              ))}
              {(onEdit || onDelete) && (
                <TableCell>
                  <div className="flex items-center gap-1">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEdit(record)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => onDelete(record.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
