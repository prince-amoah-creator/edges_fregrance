
import os
import uuid
from decimal import Decimal, InvalidOperation

from flask import Blueprint, jsonify, request, current_app
from PIL import Image, UnidentifiedImageError

from database import db
from models.product import Product

products_bp = Blueprint("products", __name__)

ALLOWED_FORMATS = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp"
}


def validate_price(value):
    try:
        price = Decimal(str(value))

        if not price.is_finite() or price <= 0:
            return None

        return price.quantize(Decimal("0.01"))

    except (InvalidOperation, TypeError, ValueError):
        return None


# GET: Display all products
@products_bp.route("/api/products", methods=["GET"])
def get_products():

    products = Product.query.order_by(
        Product.sort_order.asc(),
        Product.created_at.desc()
    ).all()

    return jsonify({
        "status": "success",
        "products": [product.to_dict() for product in products]
    })


# GET: Display one product
@products_bp.route("/api/products/<string:product_id>", methods=["GET"])
def get_product(product_id):

    product = db.session.get(Product, product_id)

    if not product:
        return jsonify({"error": "Product not found"}), 404

    return jsonify({
        "status": "success",
        "product": product.to_dict()
    })


# POST: Add a new product
@products_bp.route("/api/products", methods=["POST"])
def create_product():

    name = request.form.get("name", "").strip()
    description = request.form.get("description", "").strip()
    tag = request.form.get("tag", "").strip()
    price = validate_price(request.form.get("price"))

    if not name:
        return jsonify({"error": "Product name is required"}), 400

    if len(name) > 150:
        return jsonify({"error": "Product name is too long"}), 400

    if price is None:
        return jsonify({"error": "Enter a valid product price"}), 400

    image_file = request.files.get("image")

    if not image_file or not image_file.filename:
        return jsonify({"error": "Product photograph is required"}), 400

    upload_folder = os.path.join(
        current_app.static_folder, "uploads"
    )

    os.makedirs(upload_folder, exist_ok=True)

    try:
        image = Image.open(image_file.stream)
        image.verify()

        image_file.stream.seek(0)
        image = Image.open(image_file.stream)

        if image.format not in ALLOWED_FORMATS:
            return jsonify({
                "error": "Only JPG, PNG and WEBP images are allowed"
            }), 400

        extension = ALLOWED_FORMATS[image.format]
        filename = f"{uuid.uuid4().hex}{extension}"

        image_path = os.path.join(upload_folder, filename)
        image.save(image_path)

    except (UnidentifiedImageError, OSError, ValueError):
        return jsonify({"error": "Invalid image file"}), 400

    product = Product(
        name=name,
        description=description,
        price=price,
        image=f"/static/uploads/{filename}",
        tag=tag or None,
        sort_order=0
    )

    try:
        db.session.add(product)
        db.session.commit()

        return jsonify({
            "status": "success",
            "message": "Product added successfully",
            "product": product.to_dict()
        }), 201

    except Exception:
        db.session.rollback()

        if os.path.exists(image_path):
            os.remove(image_path)

        current_app.logger.exception("Product creation failed")

        return jsonify({"error": "Could not save product"}), 500


# PUT: Update an existing product
@products_bp.route("/api/products/<string:product_id>", methods=["PUT"])
def update_product(product_id):

    product = db.session.get(Product, product_id)

    if not product:
        return jsonify({"error": "Product not found"}), 404

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "JSON data is required"}), 400

    if "name" in data:
        name = data["name"]

        if not isinstance(name, str) or not name.strip() or len(name.strip()) > 150:
            return jsonify({"error": "Invalid product name"}), 400

        product.name = name.strip()

    if "description" in data:
        product.description = data["description"]

    if "tag" in data:
        product.tag = data["tag"]

    if "price" in data:
        price = validate_price(data["price"])

        if price is None:
            return jsonify({"error": "Invalid product price"}), 400

        product.price = price

    if "sortOrder" in data:
        try:
            product.sort_order = int(data["sortOrder"])
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid sort order"}), 400

    try:
        db.session.commit()

        return jsonify({
            "status": "success",
            "message": "Product updated successfully",
            "product": product.to_dict()
        })

    except Exception:
        db.session.rollback()
        current_app.logger.exception("Product update failed")
        return jsonify({"error": "Could not update product"}), 500


# DELETE: Remove a product
@products_bp.route("/api/products/<string:product_id>", methods=["DELETE"])
def delete_product(product_id):

    product = db.session.get(Product, product_id)

    if not product:
        return jsonify({"error": "Product not found"}), 404

    try:
        db.session.delete(product)
        db.session.commit()

        return jsonify({
            "status": "success",
            "message": "Product deleted successfully"
        })

    except Exception:
        db.session.rollback()
        current_app.logger.exception("Product deletion failed")
        return jsonify({"error": "Could not delete product"}), 500
