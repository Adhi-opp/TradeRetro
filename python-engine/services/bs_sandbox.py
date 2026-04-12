"""
BS Detector — Strategy Sandbox
===============================
AST-based validation and safe execution of user-provided Python strategy code.
Prevents imports, I/O, and attribute access outside the candle object.
"""

import ast

import pandas as pd
from fastapi import HTTPException

# Columns available to user-defined strategy code
ALLOWED_COLUMNS = {
    "open", "high", "low", "close", "volume",
    "sma_20", "sma_50", "sma_200",
    "rsi_14", "macd", "macd_signal",
    "upper_bb", "lower_bb",
}

SAFE_BUILTINS = {
    "abs": abs,
    "bool": bool,
    "float": float,
    "int": int,
    "len": len,
    "max": max,
    "min": min,
    "round": round,
}


class SafeCandle:
    """A narrow view over a row that exposes only whitelisted data fields."""

    __slots__ = ("_values",)

    def __init__(self, row: pd.Series):
        self._values = {col: row[col] for col in ALLOWED_COLUMNS if col in row.index}

    def __getattr__(self, name: str):
        if name in self._values:
            return self._values[name]
        raise AttributeError(f"Column '{name}' is not available in the strategy sandbox.")

    def __getitem__(self, key: str):
        return self._values[key]

    def get(self, key: str, default=None):
        return self._values.get(key, default)


def _collect_assigned_names(node: ast.AST) -> set[str]:
    names: set[str] = set()

    def collect_target(target: ast.AST) -> None:
        if isinstance(target, ast.Name):
            names.add(target.id)
            return
        if isinstance(target, (ast.Tuple, ast.List)):
            for elt in target.elts:
                collect_target(elt)
            return
        raise HTTPException(
            status_code=400,
            detail="Strategy assignments may only target local variable names.",
        )

    for child in ast.walk(node):
        if isinstance(child, ast.Assign):
            for target in child.targets:
                collect_target(target)
        elif isinstance(child, ast.AugAssign):
            collect_target(child.target)
        elif isinstance(child, ast.AnnAssign):
            collect_target(child.target)

    return names


class StrategyValidator(ast.NodeVisitor):
    """Allow only the small Python subset required by strategy expressions."""

    ALLOWED_NODE_TYPES = (
        ast.Module, ast.FunctionDef, ast.arguments, ast.arg,
        ast.Return, ast.Assign, ast.AugAssign, ast.AnnAssign,
        ast.Expr, ast.If, ast.Pass, ast.Name, ast.Load, ast.Store,
        ast.Constant, ast.BoolOp, ast.BinOp, ast.UnaryOp, ast.Compare,
        ast.IfExp, ast.Attribute, ast.Call, ast.Subscript, ast.List,
        ast.Tuple, ast.keyword, ast.And, ast.Or, ast.Not,
        ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.Pow,
        ast.UAdd, ast.USub,
        ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE,
        ast.Is, ast.IsNot, ast.In, ast.NotIn,
    )

    def __init__(self, function_name: str, assigned_names: set[str]):
        self.function_name = function_name
        self.assigned_names = assigned_names

    def validate(self, function_node: ast.FunctionDef) -> None:
        self.visit(function_node)

    def generic_visit(self, node: ast.AST) -> None:
        if not isinstance(node, self.ALLOWED_NODE_TYPES):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Unsupported syntax in {self.function_name}: {type(node).__name__}. "
                    "Use simple assignments, comparisons, arithmetic, and return statements only."
                ),
            )
        super().generic_visit(node)

    def visit_Name(self, node: ast.Name) -> None:
        if isinstance(node.ctx, ast.Store):
            return
        allowed_names = {"candle", "entry_price", *SAFE_BUILTINS.keys(), *self.assigned_names}
        if node.id not in allowed_names:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Name '{node.id}' is not allowed in {self.function_name}. "
                    "Use candle fields, entry_price, local variables, and safe builtins only."
                ),
            )

    def visit_Attribute(self, node: ast.Attribute) -> None:
        if not isinstance(node.value, ast.Name) or node.value.id != "candle":
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Only candle.<column> access is allowed in {self.function_name}. "
                    f"Attribute '{node.attr}' is not permitted."
                ),
            )
        if node.attr not in ALLOWED_COLUMNS and node.attr != "get":
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Column '{node.attr}' is not available in {self.function_name}. "
                    f"Allowed columns: {', '.join(sorted(ALLOWED_COLUMNS))}."
                ),
            )
        self.visit(node.value)

    def visit_Subscript(self, node: ast.Subscript) -> None:
        if not isinstance(node.value, ast.Name) or node.value.id != "candle":
            raise HTTPException(
                status_code=400,
                detail=f"Only candle['column'] access is allowed in {self.function_name}.",
            )
        key = node.slice
        if not isinstance(key, ast.Constant) or not isinstance(key.value, str):
            raise HTTPException(
                status_code=400,
                detail=f"candle[...] keys in {self.function_name} must be string constants.",
            )
        if key.value not in ALLOWED_COLUMNS:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Column '{key.value}' is not available in {self.function_name}. "
                    f"Allowed columns: {', '.join(sorted(ALLOWED_COLUMNS))}."
                ),
            )
        self.visit(node.value)
        self.visit(key)

    def visit_Call(self, node: ast.Call) -> None:
        if isinstance(node.func, ast.Name):
            if node.func.id not in SAFE_BUILTINS:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Function '{node.func.id}' is not allowed in {self.function_name}. "
                        f"Allowed builtins: {', '.join(sorted(SAFE_BUILTINS))}."
                    ),
                )
        elif isinstance(node.func, ast.Attribute):
            if not (
                isinstance(node.func.value, ast.Name)
                and node.func.value.id == "candle"
                and node.func.attr == "get"
            ):
                raise HTTPException(
                    status_code=400,
                    detail=f"Only safe builtins and candle.get(...) are allowed in {self.function_name}.",
                )
            if not node.args:
                raise HTTPException(
                    status_code=400,
                    detail=f"candle.get(...) in {self.function_name} requires a column name.",
                )
            key = node.args[0]
            if not isinstance(key, ast.Constant) or not isinstance(key.value, str):
                raise HTTPException(
                    status_code=400,
                    detail=f"candle.get(...) in {self.function_name} requires a string column name.",
                )
            if key.value not in ALLOWED_COLUMNS:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Column '{key.value}' is not available in {self.function_name}. "
                        f"Allowed columns: {', '.join(sorted(ALLOWED_COLUMNS))}."
                    ),
                )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported function call pattern in {self.function_name}. Use safe builtins or candle.get(...).",
            )
        for arg in node.args:
            self.visit(arg)
        for keyword in node.keywords:
            self.visit(keyword)


def validate_strategy_body(body: str, name: str) -> None:
    if not body or not body.strip():
        raise HTTPException(status_code=400, detail=f"{name} cannot be empty.")

    code = f"def {name}(candle, entry_price=None):\n"
    for line in body.strip().splitlines():
        code += f"    {line}\n"

    try:
        module = ast.parse(code, mode="exec")
    except SyntaxError as exc:
        raise HTTPException(status_code=400, detail=f"Syntax error in {name}: {exc}") from exc

    function_node = module.body[0]
    if not isinstance(function_node, ast.FunctionDef):
        raise HTTPException(status_code=400, detail=f"Invalid function body for {name}.")

    assigned_names = _collect_assigned_names(function_node)
    validator = StrategyValidator(name, assigned_names)
    validator.validate(function_node)


def build_safe_function(body: str, name: str):
    """
    Compile a user-provided Python function body into a callable.
    Restricted to a validated subset of Python with no imports or I/O access.
    """
    validate_strategy_body(body, name)

    code = f"def {name}(candle, entry_price=None):\n"
    for line in body.strip().splitlines():
        code += f"    {line}\n"

    safe_globals = {"__builtins__": SAFE_BUILTINS}
    safe_locals = {}

    try:
        exec(compile(code, f"<{name}>", "exec"), safe_globals, safe_locals)
    except SyntaxError as e:
        raise HTTPException(status_code=400, detail=f"Syntax error in {name}: {e}")

    return safe_locals[name]
