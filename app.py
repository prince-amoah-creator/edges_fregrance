from flask import Flask, jsonify
from sqlalchemy import text

from config import Config
from database import db
from models.product import Product
from routes.product import products_bp
from flask import Flask, render_template


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)

    with app.app_context():
        db.create_all()

    # @app.route("/")
    # def index():
    #     return render_template("admin.html")

    @app.route("/")
    def index():
        return render_template("index.html")
    
    @app.route("/api/health")
    def database_health():
        try:
            with db.engine.connect() as connection:
                connection.execute(text("SELECT 1"))

            return jsonify({
                "status": "success",
                "database": "connected"
            })

        except Exception:
            app.logger.exception("Database connection failed.")
            return jsonify({
                "status": "error",
                "database": "disconnected"
            }), 503

    @app.route("/admin")
    def admin_page():
        return render_template("admin.html")
        
    return app


app = create_app()

app.register_blueprint(products_bp)

if __name__ == "__main__":
    app.run(debug=True)