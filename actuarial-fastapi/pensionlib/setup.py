from setuptools import setup, find_packages

setup(
    name="pensionlib",
    version="0.1.0",
    description="Deterministic pension actuarial engine (pensionlib)",
    packages=find_packages(),
    install_requires=[
        "pydantic>=2.0"
    ],
)
