import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
load_dotenv("Backend.env")

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
