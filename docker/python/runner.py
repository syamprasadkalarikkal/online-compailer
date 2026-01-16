import sys
import os

def main():
    code_dir = '/app/code'
    
    if not os.path.exists(code_dir):
        print("Error: Code directory not found", file=sys.stderr)
        sys.exit(1)
    
    code_files = [f for f in os.listdir(code_dir) if f.endswith('.py')]
    
    if not code_files:
        print("Error: No Python file found", file=sys.stderr)
        sys.exit(1)
    
    code_file = os.path.join(code_dir, code_files[0])
    
    try:
        with open(code_file, 'r') as f:
            code = f.read()
        
        exec(code, {'__name__': '__main__'})
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()